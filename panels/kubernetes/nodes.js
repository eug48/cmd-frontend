/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load(args) {
    const { runCommand, setData, debug, warn, error } = args

    const nodesJson = await runCommand("nodes")
    const nodesList = JSON.parse(nodesJson)

    const topText = await runCommand("nodes-top")
    const topData = {} // node --> [node, cpu, cpu%, memory, memory%]
    for (const line of topText.split("\n")) {
        const fields = line.split(/ +/)
        topData[ fields[0] ] = fields
    }

    async function* extractData() {

        for (const node of nodesList.items) {
            const { metadata, status } = node
            const spec = node.spec || {}
            const { name } = metadata

            const [_, cpu, cpuPercent, memory, memoryPercent] = topData[name]

            yield {
                cells: [name, cpu, cpuPercent, memory, memoryPercent],
                key: name,
                getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {
                    setData([
                        {
                            buttons: [
                                {
                                    text: "show",
                                    onClicked() {
                                        showModal({ json: node })
                                    }
                                },
                            ],
                        },
                        {
                            title: "Taints",
                            fields: ["Effect", "Key", "Value"],
                            rows: (spec.taints || []).map(taint => ({
                                key: `${taint.key}-${taint.value}`,
                                cells: [
                                    taint.effect,
                                    taint.key,
                                    taint.value,
                                ],
                            }))
                        },
                        {
                            title: "Conditions",
                            fields: ["Type", "Status", "Reason", "Message", "Transition", "Heartbeat"],
                            rows: node.status.conditions.map(condition => ({
                                key: condition.type,
                                cells: [
                                    condition.type,
                                    condition.status,
                                    condition.reason,
                                    condition.message,
                                    condition.lastTransitionTime,
                                    condition.lastHeartbeatTime,
                                ],
                            }))
                        }
                    ])


                }
            }

        }
    }

    setData({
        fields: [ "Name", "CPU", "CPU%", "Memory", "Memory %" ],
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
