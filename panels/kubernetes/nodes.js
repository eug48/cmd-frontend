/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load(args) {
    const { runCommand, setData, debug, warn, error } = args

    const nodesJson = await runCommand("nodes")
    const nodesList = JSON.parse(nodesJson)


    async function* extractData() {

        for (const node of nodesList.items) {
            const { metadata, status } = node
            const { name } = metadata

            yield {
                cells: [name],
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
        fields: [
            "Name",
        ],
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
