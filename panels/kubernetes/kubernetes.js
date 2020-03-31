/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load(args) {
    const { setData, runCommand } = args

    const podsJson = await runCommand("pods")
    const podMetricsJson = await runCommand("pod-metrics")
    const allPods = JSON.parse(podsJson)
    const allPodMetrics = JSON.parse(podMetricsJson)

    const deployments = await loadForController("Deployments", allPods, allPodMetrics, args)
    const statefulsets = await loadForController("StatefulSets", allPods, allPodMetrics, args)
    const daemonsets = await loadForController("DaemonSets", allPods, allPodMetrics, args)

    setData([deployments, statefulsets, daemonsets])
}

/**
 * @param kind {string}
 * @param args {LoadFunctionArgs}
 */
export async function loadForController(kind, allPods, allPodMetrics, args) {
    const { runCommand, setData, debug, warn, error } = args
    const deploymentsJson = await runCommand(kind.toLowerCase())

    const allDeployments = JSON.parse(deploymentsJson)

    async function* extractData() {

        for (const deployment of allDeployments.items) {
            const { metadata, status } = deployment
            const { name, namespace } = metadata

            const pods = findPods(deployment, allPods)
            const podNames = pods.map(p => p.metadata.name)
            const metrics = allPodMetrics.items.filter(m => podNames.includes(m.metadata.name)).flatMap(m => m.containers)

            const { replicas, readyReplicas } = status
            const replicasCell = {
                warning: readyReplicas !== replicas,
                text: `${readyReplicas || 0}/${replicas}`,
                tooltip: 'available / total',
            }

            const { numberAvailable, desiredNumberScheduled } = status
            const daemonsetStatusCell = {
                warning: numberAvailable !== desiredNumberScheduled,
                text: `${numberAvailable || 0}/${desiredNumberScheduled}`,
                tooltip: 'available / desired',
            }

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

            const containers = deployment.spec.template.spec.containers
            const images = containers.map(c => displayDockerImage(c.image).text).filter((v, i, a) => a.indexOf(v) == i /* remove duplicates https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates#comment64491530_14438954 */)

            yield {
                cells: [namespace, name, images, /* imageDate,*/ replicas ? replicasCell : daemonsetStatusCell, metricsMemory, metricsCPU],
                key: `${namespace}-${name}`,
                getExpandedDetail: getControllerExpandedDetail(namespace, deployment, pods, allPodMetrics),
            }

        }
    }

    const rows = await toArray(extractData())

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
    async function getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {

        function metricsCell(extractFn, formatFn) {

            return function (pod, container) {
                const podName = pod.metadata.name
                const podMetrics = allPodMetrics.items.find(m => m.metadata.name == podName)
                if (!podMetrics) {
                    console.warn(`getControllerExpandedDetail: missing metrics for pod ${podName}`)
                    debugger
                    return
                }
                const containerMetrics = podMetrics.containers.find(m => m.name == container.name)
                if (!containerMetrics) {
                    console.warn(`getControllerExpandedDetail: missing metrics for container ${podName} ${container.name}`)
                    debugger
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
                        text: "edit",
                        onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${namespace} edit ${controller.kind.toLowerCase()} ${controller.metadata.name}`)
                            showTooltip("command copied to clipboard")
                        }
                    },
                ],
            },
            {
                fields: ["Pod", "Phase", "Node", "Container", "Image", "Memory", "CPU"],
                rows: pods.flatMap(pod => pod.spec.containers.map(container => ({ pod, container }))).map(({ pod, container }) => ({
                    key: pod.metadata.name + '-' + container.name,
                    cells: [
                        pod.metadata.name,
                        pod.status.phase,
                        pod.spec.nodeName,
                        container.name,
                        displayDockerImage(container.image),
                        metricsMemory(pod, container),
                        metricsCPU(pod, container),
                    ],
                    getExpandedDetail: getPodExpandedDetail(namespace, pod),
                }))
            }
        ])

    }
    return getExpandedDetail
}

function getPodExpandedDetail(namespace, pod) {
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

        setData([
            {
                // title: "Actions",
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
                        onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${namespace} logs ${pod.metadata.name} --all-containers --follow`)
                            showTooltip("command copied to clipboard")
                        }
                    },
                ],
            },
            // { title: "Memory Usage", json: processMemoryUsage, },
            // { title: "Node Report", json: reportJson, },
            // { title: "Heap", json: heap, },
            // { title: "Heap Spaces", json: heapSpaces, },
            // { title: "Proc status", text: procStatusMemory, },
        ])

    }
    return getExpandedDetail
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

function findPods(deployment, allPods) {
    const { namespace } = deployment.metadata
    const { selector } = deployment.spec
    const { matchLabels, matchExpressions } = selector

    if (matchExpressions) {
        console.warn("deployment using matchExpressions - not supported", deployment.metadata)
        return []
    }

    const found = []
    pods: for (const pod of allPods.items) {
        const { labels, namespace: podNamespace } = pod.metadata

        if (namespace !== podNamespace) {
            continue
        }

        for (const [k, v] of Object.entries(matchLabels)) {
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



async function toArray(source) {
    let items = []
    for await (const item of source) {
        items.push(item)
    }
    return items
}
