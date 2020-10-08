/// <reference path="../../frontend/types.d.ts" />

// @ts-ignore
import * as timeago from '/js/web_modules/timeago.js';

/**
 * @param args {LoadFunctionArgs}
 */
export async function load(args) {
    const { setData, runCommand } = args

    async function runJsonCommands(commands) {
        return (await Promise.all(commands.map(cmd => runCommand(cmd)))).map(t => JSON.parse(t))
    }
    const [pods, podMetrics, deploymentsJson, statefulsetJson, daemonsetJson] =
        await runJsonCommands(["pods", "pod-metrics", "deployments", "statefulsets", "daemonsets"])

    const deployments = loadForController("Deployments", deploymentsJson, pods, podMetrics, args)
    const statefulsets = loadForController("StatefulSets", statefulsetJson, pods, podMetrics, args)
    const daemonsets = loadForController("DaemonSets", daemonsetJson, pods, podMetrics, args)

    setData([deployments, statefulsets, daemonsets])
}

/**
 * @param kind {string}
 * @param args {LoadFunctionArgs}
 */
export function loadForController(kind, resources, allPods, allPodMetrics, args) {
    const { runCommand, setData, debug, warn, error } = args

    function* extractData() {

        for (const controller of resources.items) {
            const { metadata, status } = controller
            const { name, namespace } = metadata

            const pods = findPods(controller, allPods)
            const podNames = pods.map(p => p.metadata.name)
            const metrics = allPodMetrics.items.filter(m => podNames.includes(m.metadata.name)).flatMap(m => m.containers)

            const replicasCell = function () {
                if (controller.kind === "DaemonSet") {
                    const { numberAvailable, desiredNumberScheduled } = status
                    return {
                        warning: numberAvailable !== desiredNumberScheduled,
                        text: `${numberAvailable || 0}/${desiredNumberScheduled}`,
                        tooltip: `${numberAvailable} available / ${desiredNumberScheduled} desired`,
                    }
                } else {
                    const { readyReplicas, replicas } = status
                    if (replicas) {
                        return {
                            warning: readyReplicas !== replicas,
                            text: `${readyReplicas || 0}/${replicas}`,
                            tooltip: `${readyReplicas} ready / ${replicas} total`,
                        }
                    } else {
                        return {
                            warning: true,
                            text: '0',
                            tooltip: "no replicas",
                        }
                    }
                }
            }()

            function metricsCell(extractFn, formatFn) {
                if (metrics.length == 0) {
                    return {}
                }
                const values = metrics.map(extractFn)
                const sum = values.map(s => parseInt(s)).reduce((a, b) => a + b, 0)
                const suffix = values[0].replace(/\d+/, "")
                return {
                    sortKey: sum,
                    // tooltip: "Total: " + sum,
                    // text: values.map(formatFn).join(", "),
                    text: formatFn(sum + suffix),
                }
            }
            const metricsMemory = metricsCell(c => c.usage.memory, formatSize)
            const metricsCPU = metricsCell(c => c.usage.cpu, formatCpuTime)

            const containers = controller.spec.template.spec.containers
            const images = containers.map(c => displayDockerImage(c.image).text).filter((v, i, a) => a.indexOf(v) == i /* remove duplicates https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates#comment64491530_14438954 */)

            yield {
                cells: [namespace, name, images, /* imageDate,*/ replicasCell, metricsMemory, metricsCPU],
                key: `${namespace}-${name}`,
                getExpandedDetail: getControllerExpandedDetail(namespace, controller, pods, allPodMetrics),
            }

        }
    }

    const rows = toArray(extractData())

    return {
        title: kind,
        fields: [
            "Namespace",
            "Name", // kind.substr(0, kind.length - 1),
            "Images",
            // "Image date",
            kind == "DaemonSets" ? "Status" : "Replicas",
            "Memory",
            "CPU",
        ],
        rows,
    }
}

function getControllerExpandedDetail(namespace, controller, pods, allPodMetrics) {
    /**
     * @param args {LoadFunctionArgs}
     */
    function getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {

        function metricsCell(extractFn, formatFn) {

            return function (pod, container) {
                const podName = pod.metadata.name
                const podMetrics = allPodMetrics.items.find(m => m.metadata.name == podName)
                if (!podMetrics) {
                    console.warn(`getControllerExpandedDetail: missing metrics for pod ${podName}`)
                    return
                }
                const containerMetrics = podMetrics.containers.find(m => m.name == container.name)
                if (!containerMetrics) {
                    console.warn(`getControllerExpandedDetail: missing metrics for container ${podName} ${container.name}`)
                    return
                }
                const value = extractFn(containerMetrics)
                return {
                    sortKey: parseInt(value),
                    text: formatFn(value),
                }
            }
        }
        const metricsMemory = metricsCell(c => c.usage.memory, formatSize)
        const metricsCPU = metricsCell(c => c.usage.cpu, formatCpuTime)
        const kind = controller.kind.toLowerCase()
        const name = controller.metadata.name

        function formatStartTime(startTime) {
            const d = new Date(startTime)
            return `${d.toLocaleString()} (${timeago.format(d)})`
        }

        setData([
            {
                buttons: [
                    {
                        text: "show",
                        onClicked() {
                            showModal({ json: controller })
                        }
                    },
                    {
                        text: "describe",
                        async onClicked() {
                            const output = await runCommand("describe", namespace, kind, name)
                            showModal({ text: output })
                        }
                    },
                    {
                        text: "logs",
                        async onClicked(showTooltip) {
                            const { matchLabels } = controller.spec.selector
                            const key = Object.keys(matchLabels)[0]
                            const value = Object.values(matchLabels)[0]

                            setClipboard(`kubectl -n ${namespace} logs -l {key}={value} --all-containers --tail=10000`)
                            const output = await runCommand("logs-for-selector", namespace, key, value)
                            showModal({ text: output })
                        }
                    },
                    {
                        text: "edit",
                        onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${namespace} edit ${kind} ${name}`)
                            showTooltip("command copied to clipboard")
                        }
                    },
                    {
                        text: "delete",
                        onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${namespace} delete ${kind} ${name}`)
                            showTooltip("command copied to clipboard")
                        }
                    },
                ],
            },
            {
                fields: ["Pod", "Phase", "Started", "Restarts", "Ready", "Container", "Image", "Node", "Memory", "CPU"],
                rows: pods.flatMap(pod => pod.spec.containers.map((container, ci) => ({ pod, container, ci }))).map(({ pod, container, ci }) => ({
                    key: pod.metadata.name + '-' + container.name,
                    cells: [
                        pod.metadata.name,
                        pod.status.phase,
                        formatStartTime(pod.status.startTime),
                        pod.status.containerStatuses?.[ci]?.restartCount,
                        pod.status.containerStatuses?.[ci]?.ready,
                        container.name,
                        displayDockerImage(container.image),
                        pod.spec.nodeName,
                        metricsMemory(pod, container),
                        metricsCPU(pod, container),
                    ],
                    getExpandedDetail: getPodContainerExpandedDetail(namespace, pod, container.name),
                }))
            }
        ])

    }
    return getExpandedDetail
}

function getPodContainerExpandedDetail(namespace, pod, containerName) {
    /**
     * @param args {LoadFunctionArgs}
     */
    async function getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {
        // const getInfo = async name => {
        //     const jsonString = await runCommand("pod-http-diagnostic-info", namespace, pod, name)
        //     return JSON.parse(jsonString, withMegabytes)
        // }
        // const reportJson = await getInfo("report")
        // const heapSpaces = await getInfo("getHeapSpaceStatistics")
        // const heap = await getInfo("getHeapStatistics")
        // const processMemoryUsage = await getInfo("processMemoryUsage")

        // const pid = 1
        // const procStatus = await runCommand("pod-pid-status", namespace, pod, pid)
        // const procStatusMemory = procStatus.split("\n").filter(s => s.includes("kB")).join("\n")
        const secrets = new Set()
        const configMaps = new Set()

        for (const volume of pod.spec.volumes ?? []) {
            if (volume.secret) {
                secrets.add(volume.secret.secretName)
            }
            if (volume.configMap) {
                configMaps.add(volume.configMap.name)
            }
        }
        for (const env of pod.spec.containers.flatMap(c => c.env) ?? []) {
            const valueFrom = env?.valueFrom

            const secretKeyRef = valueFrom?.secretKeyRef
            if (secretKeyRef) {
                secrets.add(secretKeyRef.name)
            }

            const configMapKeyRef = valueFrom?.configMapKeyRef
            if (configMapKeyRef) {
                configMaps.add(configMapKeyRef.name)
            }
        }

        setData([
            {
                buttons: [
                    {
                        text: "show",
                        onClicked() {
                            showModal({ json: pod })
                        }
                    },
                    {
                        text: "describe",
                        async onClicked() {
                            const output = await runCommand("describe", namespace, "pod", pod.metadata.name)
                            showModal({ text: output })
                        }
                    },
                    {
                        text: "exec sh",
                        onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${namespace} exec ${pod.metadata.name} -it -- sh`)
                            showTooltip("command copied to clipboard")
                        }
                    },
                    {
                        text: "logs",
                        async onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${namespace} logs ${pod.metadata.name} -c ${containerName} --follow`)
                            // showTooltip("command copied to clipboard")

                            const output = await runCommand("logs-for-container", namespace, pod.metadata.name, containerName)
                            showModal({ text: output })
                        }
                    },
                    {
                        text: "logs (prev)",
                        async onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${namespace} logs ${pod.metadata.name} --all-containers --previous`)
                            // showTooltip("command copied to clipboard")

                            const output = await runCommand("logs-prev", namespace, pod.metadata.name)
                            showModal({ text: output })
                        }
                    },
                    {
                        text: "delete",
                        onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${namespace} delete pod ${pod.metadata.name}`)
                            showTooltip("command copied to clipboard")
                        }
                    },
                ],
            },
            ...(configMaps.size == 0 ? [] : [{
                title: "config maps",
                rows: [...configMaps].sort().map(name => ({
                    key: name,
                    cells: [name],
                    getExpandedDetail: getConfigMapOrSecretExpandedDetail(namespace, "configMap", name, s => s),
                })),
            }]),
            {
                title: "secrets",
                rows: [...secrets].sort().map(name => ({
                    key: name,
                    cells: [name],
                    getExpandedDetail: getConfigMapOrSecretExpandedDetail(namespace, "secret", name, atob),
                })),
            }
            // { title: "Memory Usage", json: processMemoryUsage, },
            // { title: "Node Report", json: reportJson, },
            // { title: "Heap", json: heap, },
            // { title: "Heap Spaces", json: heapSpaces, },
            // { title: "Proc status", text: procStatusMemory, },
        ])

    }
    return getExpandedDetail
}


function getConfigMapOrSecretExpandedDetail(namespace, kind, name, valueTransformer) {
    /**
     * @param args {LoadFunctionArgs}
     */
    return async function getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {

        const json = JSON.parse(await runCommand("resource-get", kind, name, namespace))

        setData([
            {
                buttons: [
                    {
                        text: "show",
                        onClicked() {
                            showModal({ json })
                        }
                    },
                    {
                        text: "delete",
                        onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${namespace} delete ${kind} ${name}`)
                            showTooltip("command copied to clipboard")
                        }
                    },
                ],
            },
            {
                rows: Object.entries(json.data).map(([key, value]) => ({ key, cells: [key, valueTransformer(value)] })),
            }
        ])
    }
}


function withMegabytes(key, value) {
    // console.log(key, value)
    if (typeof (value) === 'number' && value > 1000) {
        this[key + "_mb"] = value / 1024 / 1024
        return undefined
    } else {
        return value
    }
}

function findPods(controller, allPods) {
    const { namespace } = controller.metadata
    const { selector } = controller.spec
    const { matchLabels, matchExpressions } = selector

    if (matchExpressions) {
        console.warn("controller using matchExpressions - not supported", controller.metadata)
        return []
    }

    const found = []
    pods: for (const pod of allPods.items) {
        const { labels, namespace: podNamespace } = pod.metadata

        if (namespace !== podNamespace) {
            continue
        }

        for (const [k, v] of Object.entries(matchLabels)) {
            if (!labels) {
                continue pods
            }
            if (labels[k] !== v) {
                continue pods
            }
        }

        found.push(pod)
    }

    return found
}

/**
 * @param str {string}
 */
function formatSize(str) {
    if (str.endsWith("Ki")) {
        return (parseInt(str, 10) / 1024).toFixed(1) + "Mb"
    } else {
        return str
    }
}

/**
 * @param str {string}
 */
function formatCpuTime(str) {
    if (str.endsWith("n")) {
        return (parseInt(str, 10) / Math.pow(10, 9)).toFixed(3) + "s"
    } else {
        return str
    }
}


/**
 * @param imageStr {string}
 */
async function getImageGitDate(imageStr, runCommand) {

    const [imageName, imageTag] = imageStr.split(":")
    if (imageTag && imageTag.match(/^[a-z0-9]{40}$/)) {
        // look up git hash
        try {
            const commitDetails = await runCommand("git-commit-details", imageTag)
            /* output like:

            commit fcaa3a760bf89417ade67ebf26703bc1aeb80bda
            Author: Eugene <eugene@patsoftware.com.au>
            Date:   Fri Jun 14 16:27:16 2019 +1000

                backend: updated node to 10.13.0
            */
            const [commitLine, authorLine, dateLine, ...messageLines] = commitDetails.split("\n").map(s => s.trim())
            const date = new Date(dateLine.substr(5).trim())

            return {
                text: date.toDateString(),
                tooltip: commitDetails,
                sortKey: date.getTime(),
            }

        } catch {
            // likely git object not found
        }

    }
    return null
}

/**
 * @param imageStr {string}
 */
function displayDockerImage(imageStr) {
    const sha256pos = imageStr.indexOf("@sha256:")
    if (sha256pos > 0) {
        // trim sha256 hash
        return {
            text: imageStr.substring(0, sha256pos + 8 + 8),
            tooltip: imageStr,
        }
    } else {
        // shorten 40-character SHA1 hashes to 8 characters
        return {
            text: imageStr.replace(/([a-z0-9]{8})[a-z0-9]{32}/, "$1"),
            tooltip: imageStr,
        }
    }
}



function toArray(source) {
    let items = []
    for (const item of source) {
        items.push(item)
    }
    return items
}
