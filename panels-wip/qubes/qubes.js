/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load({ runCommand, setData, debug, warn, error }) {
    const rawData = await runCommand("qvm-ls")

    function* extractData() {
        for (const field of parseTextTable(rawData)) {

            const name = field("NAME")
            const state = field("STATE")
            const label = field("LABEL")
            const template = field("TEMPLATE")
            const ip = field("IP")
            const netvm = field("NETVM")
            const privCurr = field("PRIV-CURR")
            const privMax = field("PRIV-MAX")
            const rootCurr = field("ROOT-CURR")
            const rootMax = field("ROOT-MAX")

            // skip dom0
            if (name === "dom0") {
                continue
            }

            function stateCellIcon() {
                switch (state) {
                    case "Running": return "play"
                    case "Halted": return "stop"
                    // case "Halted": return "square outline"
                    case "Paused": return "pause"
                    case "Transient": return "play circle"
                    default:
                        warn("UNKNOWN state", state)
                        return "question"
                }
            }
            const icon = stateCellIcon()

            function getSortKey() {
                if (name.startsWith("sys-")) {
                    // put sys qubes last
                    return icon + "-zzz" + name
                } else if (name == "default-mgmt-dvm") {
                    // put default-mgmt-dvm second last
                    return icon + "-zz" + name

                } else {
                    return icon + "-" + name
                }
            }
            const stateCell = {
                icon: icon,
                color: label,
                tooltip: state,
            }

            const nameCell = {
                text: name,
                sortKey: getSortKey(),
                bold: icon.startsWith("play"),
            }

            function diskUsage(curStr, maxStr) {
                const cur = +curStr
                const max = +maxStr
                // return `${Math.floor(cur / max * 100)}% (${Math.floor(cur / 1024)} / ${Math.floor(max / 1024)})`
                
                const used_pc = Math.floor(cur / max * 100) + "%"
                const max_gb = Math.floor(max / 1024) + " GB"
                const free_mb = max - cur
                const tooltip = `Free: ${free_mb} MB`
                const warning = (cur / max) > 0.9
                return [{ text: used_pc, tooltip, warning }, max_gb]
            }

            yield {
                cells: [stateCell, nameCell, template, ...diskUsage(privCurr, privMax), ...diskUsage(rootCurr, rootMax), ip, netvm],
                key: nameCell.text,
            }
        }
    }

    const rows = Array.from(extractData())

    const data = {
        fields: [
            "", // state
            "Name",
            "Template",
            "Private storage",
            "System storage",
            "IP",
            "NetVM",
        ],
        fields2: [
            "used",
            "max",
            "used",
            "max",
        ],
        fieldColSpans: [, , , 2, 2],
        rows,

        options: [
            {
                name: "Show stopped",
                default: true,
            },

        ]
    }
    setData(data)
}

/**
 * @param {string} rawData 
 */
function* parseTextTable(rawData) {
    const lines = rawData.split("\n")

    // load headers
    const headings = new Map()
    const headerLine = lines[0]

    const regex = /(\S+)\s*/g
    let match;

    // String.matchAll is not supported by WebKit..
    //
    // for (const match of headerLine.matchAll(/(\S+)\s*/g)) {
    while ((match = regex.exec(headerLine)) !== null) {
        headings.set(match[1], {
            start: match.index,
            len: match[0].length,
            name: match[1],
        })
    }

    for (const line of lines.slice(1) /* skip header */) {
        if (!line) {
            continue
        }

        /**
         * @param fieldName {string}
         */
        function field(fieldName) {
            const { start, len } = headings.get(fieldName)
            return line.substr(start, len).trim()
        }
        yield field
    }
}
