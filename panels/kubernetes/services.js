/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load(args) {
    const { setData, runCommand } = args

    async function runJsonCommands(commands) {
        return (await Promise.all(commands.map(cmd => runCommand(cmd)))).map(JSON.parse)
    }

    const [services, endpoints] = await runJsonCommands(["services", "endpoints"])

    const data = loadServices(services, endpoints, args)
    setData([data])
}

/**
 * @param args {LoadFunctionArgs}
 */
export function loadServices(services, endpoints, args) {
    const { runCommand, setData, debug, warn, error } = args

    const endpointsByName = new Map(endpoints.items.map(item => [item.metadata.namespace + ':' + item.metadata.name, item]))

    function* extractData() {

        for (const service of services.items) {
            const { metadata, spec } = service
            const { name, namespace } = metadata
            const { clusterIP, ports, selector, type } = spec

            const selectorString = selector && Object.entries(selector).map( ([k,v]) => `${k}=${v}`).join('\n')
            const portsString = ports?.map(p => p.port == p.targetPort ? `${p.protocol} ${p.port}` :  `${p.port} -> ${p.protocol} ${p.targetPort}`).join('\n')

            const namespaceName = namespace + ':' + name
            const endpoint = endpointsByName.get(namespaceName)
            const endpointsString = endpoint && endpoint.subsets?.flatMap(s => s.addresses?.map(a => a.ip))

            yield {
                cells: [namespace, name, type, clusterIP, endpointsString, selectorString, portsString],
                key: namespaceName,
                getExpandedDetail: getServiceExpandedDetail(service, endpoint),
            }

        }
    }

    const rows = toArray(extractData())

    return {
        title: 'Services',
        fields: [
            "Namespace",
            "Name",
            "Type",
            "ClusterIP",
            "Endpoints",
            "Selector",
            "Ports",
        ],
        rows,
    }
}

function getServiceExpandedDetail(service, endpoint) {
    /**
     * @param args {LoadFunctionArgs}
     */
    async function getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {

        const showEndpointButton = !endpoint ? [] : [{
            text: "show endpoint",
            onClicked() {
                showModal({ json: endpoint })
            }
        }];

        setData([
            {
                buttons: [
                    {
                        text: "show",
                        onClicked() {
                            showModal({ json: service })
                        }
                    },
                    ...showEndpointButton,
                    {
                        text: "delete",
                        onClicked(showTooltip) {
                            setClipboard(`kubectl -n ${service.metadata.namespace} delete service ${service.metadata.name}`)
                            showTooltip("command copied to clipboard")
                        }
                    },
                ],
            },
            {
                title: 'Endpoint addresses',
                fields: ["Subset", "IP", "Node", "Target"],
                rows: endpoint?.subsets?.flatMap( (subset, subsetIndex) => subset.addresses.map(address => ({
                    key: address.ip,
                    cells: [
                        subsetIndex,
                        address.ip,
                        address.nodeName,
                        address.targetRef && address.targetRef?.kind + ' ' + address.targetRef?.name,
                    ],
                })))
            },
            {
                title: 'Endpoint ports',
                fields: ["Name", "Port", "Protocol"],
                rows: endpoint?.subsets?.flatMap( (subset, subsetIndex) => subset.ports.map(port => ({
                    key: port.port + '',
                    cells: [
                        port.name,
                        port.port,
                        port.protocol,
                    ],
                })))
            },
        ])

    }
    return getExpandedDetail
}


function toArray(source) {
    let items = []
    for (const item of source) {
        items.push(item)
    }
    return items
}
