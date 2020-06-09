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
    const [pods, podMetrics] = await runJsonCommands(["pods", "pod-metrics"])

    const data = loadPods(pods, podMetrics, args)
    setData([data])
}

/**
 * @param args {LoadFunctionArgs}
 */
export function loadPods(allPods, allPodMetrics, args) {
    const { settings, runCommand, setData, debug, warn, error } = args

    const phasesToShow = new Map([
        ["Succeeded", false],
        ["Running", true],
        ["Pending", true],
        ["Failed", true],
        ["Unknown", true],
    ])
    const defaultPahsesToShow = Array.from(phasesToShow.entries()).map( ([k ,v]) => ["Show " + k, v])
    for (const [k, v] of Object.entries(settings)) {
        if (k.startsWith("Show ")) {
            phasesToShow.set(k.substring(5), !!v)
        }
    }

    function* extractData() {

        for (const pod of allPods.items) {
            const { metadata, status } = pod
            const { name, namespace } = metadata
            const { phase, containerStatuses } = status

            const show = phasesToShow.get(phase)
            if (show === false) {
                continue
            }
            if (show === undefined) {
                error("unknown pod phase", phase)
            }

            const metrics = allPodMetrics.items.filter(m => m.metadata.name == name).flatMap(m => m.containers)

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

            const containers = pod.spec.containers
            const images = containers.map(c => displayDockerImage(c.image).text).filter((v, i, a) => a.indexOf(v) == i /* remove duplicates https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates#comment64491530_14438954 */)

            function formatStartTime(startTime) {
                const d = new Date(startTime)
                return {
                  text: timeago.format(d),
                  tooltip: d.toLocaleString(),
                }
            }
            
            const containerStatusCount = containerStatuses?.length ?? 0
            const ready = containerStatuses?.map(cs => cs.ready).reduce((a, b) => a && b, true)
            const readyStr = ready ? "ready" : "not ready"

            const restarts = containerStatuses?.map(cs => cs.restartCount).reduce((a, b) => a + b, 0)

            yield {
                cells: [
                    namespace,
                    name,
                    phase,
                    formatStartTime(status.startTime),
                    containerStatusCount > 0 ? readyStr : "",
                    restarts,
                    pod.spec.nodeName,
                ],
                key: `${namespace}-${name}`,
                getExpandedDetail: getPodExpandedDetail(namespace, pod),
            }

        }
    }

    return {
        fields: [
          "Namespace",
          "Pod",
          "Phase",
          "Started",
          "Status",
          "Restarts",
          "Node",
          //"Memory",
          //"CPU",
        ],
        rows: toArray(extractData()),
        defaultSettings: Object.fromEntries(defaultPahsesToShow),
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
                        text: "edit",
                        onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${namespace} edit ${kind} ${name}`)
                            showTooltip("command copied to clipboard")
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
                ],
            },
        ])

    }
    return getExpandedDetail
}

function getPodExpandedDetail(namespace, pod) {
    /**
     * @param args {LoadFunctionArgs}
     */
    async function getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {

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
                            setClipboard(`kubectl -n ${namespace} logs ${pod.metadata.name} --all-containers --follow`)
                            // showTooltip("command copied to clipboard")

                            const output = await runCommand("logs", namespace, pod.metadata.name)
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
            {
                fields: [
                  "Container",
                  "Restarts",
                  "Ready",
                  "Image",
                  //"Memory",
                  //"CPU"
                ],
                rows: pod.spec.containers.map((container, ci) => ({
                    key: pod.metadata.name + '-' + container.name,
                    cells: [
                        container.name,
                        pod.status.containerStatuses[ci].restartCount,
                        pod.status.containerStatuses[ci].ready,
                        displayDockerImage(container.image),
                        //metricsMemory(pod, container),
                        //metricsCPU(pod, container),
                    ],
                }))
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


function withMegabytes(key, value) {
    // console.log(key, value)
    if (typeof (value) === 'number' && value > 1000) {
        this[key + "_mb"] = value / 1024 / 1024
        return undefined
    } else {
        return value
    }
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

