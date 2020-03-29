/// <reference path="../../frontend/types.d.ts" />

const allKeys = new Set()

/**
 * @param args {LoadFunctionArgs}
 */
export async function load({ runCommand, setData, settings, debug, warn, error }) {

    const defaultFields = new Set(["Name", "VmHWM", "VmRSS", "Pid"])

    const fieldsSet = new Set(defaultFields)

    for (const [k, v] of Object.entries(settings)) {
        if (k == "Show kernel threads") {
            continue
        }

        const field = k.substr(5) // remove "Show " prefix
        if (v) {
            fieldsSet.add(field)
        } else {
            fieldsSet.delete(field)
        }
    }

    const showKernelThreads = !!settings["Show kernel threads"]

    const statusData = await runCommand("proc-statuses")
    const rows = Array.from(parseStatusFiles(statusData, fieldsSet, showKernelThreads))

    const defaultSettings = {
        "Show kernel threads": false,
    }
    Array.from(allKeys).forEach(k => {
        defaultSettings["Show " + k] = defaultFields.has(k);
    })

    setData({
        rows,
        fields: Array.from(fieldsSet),
        defaultSettings,
    })
}

/**
 * @param {string} statusData
 * @param {Set<string>} fields
 * @param {boolean} showKernelThreads
 */
function* parseStatusFiles(statusData, fields, showKernelThreads) {

    const fieldCount = fields.size
    const fieldsMap = new Map()
    fields.forEach(f => fieldsMap.set(f, fieldsMap.size))

    let cells = Array(fieldCount).fill("")
    let ignore = !showKernelThreads
    let pid = ""
    let first = true

    function getExpandedDetail(pid) {
        /**
         * @param args {LoadFunctionArgs}
         */
        async function getExpandedDetail({ runCommand, setData }) {
            try {

                const status = await runCommand("proc-status", pid)
                const cmdline = await runCommand("proc-cmdline", pid)
                const environ = await runCommand("proc-environ", pid)
                const environSorted = environ.split("\n").sort().join("\n")
                setData([
                    { title: "Commandline", text: cmdline, },
                    { title: "Environment", text: environSorted, },
                    { title: "Status", text: status, }
                ])
            } catch (err) {
                setData({
                    text: err.toString()
                })
            }
        }
        return getExpandedDetail
    }

    for (const line of statusData.split("\n")) {

        const colonPos = line.indexOf(":")
        const fieldName = line.substr(0, colonPos)
        allKeys.add(fieldName)

        if (fieldName === "Name" && !first) {
            // on to next process
            if (!ignore) {
                yield { cells, key: pid, getExpandedDetail: getExpandedDetail(pid) }
            }
            cells = Array(fieldCount).fill("")
            ignore = !showKernelThreads
        }

        if (fieldName === "Pid") {
            pid = line.substr(colonPos + 2).trim()
        }

        if (fieldName == "VmPeak") {
            ignore = false
        }

        const index = fieldsMap.get(fieldName)
        if (index != null) {

            const fieldValue = line.substr(colonPos + 2).trim()
            first = false

            if (fieldValue.endsWith(" kB")) {
                // convert to MB
                const asMB = (parseInt(fieldValue, 10) / 1024).toFixed(1) + " MB"
                cells[index] = asMB
            } else {
                cells[index] = fieldValue
            }
        }
    }

    if (cells.length > 0) {
        yield { cells, key: pid, getExpandedDetail: getExpandedDetail(pid) }
    }
}