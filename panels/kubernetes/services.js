/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load(args) {
    const { setData, runCommand } = args

    async function runJsonCommands(commands) {
        return (await Promise.all(commands.map(cmd => runCommand(cmd)))).map(t => JSON.parse(t))
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

            function formatPort(p, nodePort) {
                const {port, targetPort, protocol} = p

                if (nodePort) {
                    return `${nodePort} -> ${formatPort(p, null)}`
                }

                if (port == targetPort) {
                    return `${protocol} ${port}`
                } else {
                    return `${port} -> ${protocol} ${targetPort}`
                }
            }
            const portsString = ports?.map(p => formatPort(p, p.nodePort)).join('\n')

            const namespacedName = namespace + ':' + name
            const endpoint = endpointsByName.get(namespacedName)
            const endpointsString = endpoint && endpoint.subsets?.flatMap(s => s.addresses?.map(a => a.ip))

            function maybeBold(str) {
                if (type === "NodePort" || type === "LoadBalancer") {
                    // make stand out since more security-sensitive
                    return { bold: true, text: str }
                } else {
                    return str
                }
            }

            yield {
                cells: [
                    namespace,
                    name,
                    maybeBold(type),
                    clusterIP,
                    endpointsString,
                    selectorString,
                    maybeBold(portsString)
                ],
                key: namespacedName,
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
