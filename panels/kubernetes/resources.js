/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load(args) {
    const { runCommand, setData, debug, warn, error } = args

    const resourceTypesText = await runCommand("resource-types")

    const resourceTypes = parseKubectlWideOutput(resourceTypesText)
    const kindColumnPos = resourceTypes.headings.indexOf("KIND")
    const groupColumnPos = resourceTypes.headings.indexOf("APIGROUP")
    const kinds = []
    for (const row of resourceTypes.rows) {
        const kind = row[kindColumnPos]
        const group = row[groupColumnPos]
        kinds.push([kind, group])
    }

    async function* extractData() {

        for (const [kind, group] of kinds) {
            yield {
                cells: [kind, group],
                key: kind + '.' + group,
                /**
                 * @param args {LoadFunctionArgs}
                 */
                async getExpandedDetail({ runCommand, setData }) {
                    // show output of
                    // kubectl get -o wide
                    const text = await runCommand("resource-list", kind)
                    const table = parseKubectlWideOutput(text)
                    setData([
                        {
                            fields: table.headings,
                            rows: table.rows.map(row => ({
                                key: row[0] + row[1],
                                cells: row,
                                /**
                                 * @param args {LoadFunctionArgs}
                                 */
                                async getExpandedDetail({ runCommand, setData }) {
                                    const haveNamespace = table.headings[0] == "NAMESPACE"
                                    const ns = haveNamespace ? row[0] : "none"
                                    const name = haveNamespace ? row[1] : row[0]
                                    const json = await runCommand("resource-get", kind, name, ns)
                                    setData({ json })
                                },
                            }))
                        }
                    ])


                }
            }

        }
    }

    setData({
        fields: [ "Kind", "Group"],
        rows: await toArray(extractData()),
    })
}
async function toArray(source) {
    let items = []
    for await (const item of source) {
        items.push(item)
    }
    return items
}


/**
 * @param {string} lines
 */
function parseKubectlWideOutput(lines) {

    /** @type RegExpMatchArray[] */
    let columns = []

    let rows = []
    let header = true

    for (const line of lines.split("\n")) {
        if (header) {
            columns = Array.from(line.matchAll(/\w+ +/g))
            header = false
        } else {
            const cells = []
            for (const col of columns) {
                const cell = line.substr(col.index, col[0].length)
                cells.push(cell)
            }
            rows.push(cells)
        }
    }

    return {
        headings: columns.map(c => c[0].trimRight()),
        rows,
    }
}