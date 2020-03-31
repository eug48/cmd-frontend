import { Loader, Container, List, Header, Table, Icon, SemanticICONS, Accordion, Popup, Progress, Button, Modal, Tab, Checkbox, CheckboxProps } from '/js/web_modules/semantic-ui-react.js';
import { SemanticCOLORS } from 'semantic-ui-react/dist/commonjs/generic';

import Highlight, { defaultProps } from "/js/web_modules/prism-react-renderer.js";
// @ts-ignore
import oceanicNext from "/js/node_modules/prism-react-renderer/themes/oceanicNext/index.js"
// @ts-ignore
import github from "/js/node_modules/prism-react-renderer/themes/github/index.js"
// @ts-ignore
import duotoneLight from "/js/node_modules/prism-react-renderer/themes/duotoneLight/index.js"
// @ts-ignore
import ultramin from "/js/node_modules/prism-react-renderer/themes/ultramin/index.js"

// @ts-ignore
import ReactJsonInspector from '/js/web_modules/react-json-inspector.js';

declare var React: typeof import("react");
declare var ReactDOM: typeof import("react-dom");

interface DataCellProps {
    cell: DataCell
}
function DataCellRender({ cell }: DataCellProps) {
    if (typeof (cell) === "string") {
        return <Table.Cell>{cell}</Table.Cell>
    } else if (cell == null) {
        return <Table.Cell></Table.Cell>
    } else if (Array.isArray(cell)) {
        return <Table.Cell>{cell.map(str => <div key={str}>{str}</div>)}</Table.Cell>
    } else {
        const { text, warning, color, icon, tooltip, bold } = cell
        return (
            <Table.Cell {...{ warning }} title={tooltip}>
                {warning && <Icon name='attention' />}
                {icon && <Icon name={icon as SemanticICONS} color={color as SemanticCOLORS} />}
                {bold && <b>{text}</b>}
                {!bold && text}
            </Table.Cell>
        )
    }
}

interface ExpandedRowCellProps {
    scriptName: string
    getExpandedDetail: LoadFunction
}
function ExpandedRowCell(props: ExpandedRowCellProps) {
    const { scriptName, getExpandedDetail } = props
    const { error, dataList, modalData, setModalData, commands } = useData(scriptName, Promise.resolve(getExpandedDetail))

    if (!dataList) {
        return null
        // return <RunCommandData {...{commands}} />
    }

    if (error) {
        return <ErrorDisplay error={error} />
    }

    if (modalData) {
        return (
            <Modal
                content={<DataTableRender data={modalData} key="m" scriptName={scriptName} />}
                onClose={() => setModalData(null)}
                open
                size="fullscreen"
            />
        )
    }

    console.log("dataList", dataList)

    return (
        <>
            {dataList.map((data, i) => <DataTableRender key={i} {...{ data, scriptName }} headingType="h4" />)}
        </>
    )
}

interface DataTableProps {
    data: Data
    scriptName: string
    headingType?: "h3" | "h4"
}
function DataTableRender(props: DataTableProps) {
    const { scriptName: scriptName, data, headingType } = props
    const fieldColSpans = data.fieldColSpans || []

    const [sortColumn, setSortColumn] = React.useState<number>(NaN)
    const [sortDirection, setSortDirection] = React.useState<"ascending" | "descending">("ascending")
    const [expandedRows, setExpandedRows] = React.useState(new Set<string>())

    function onRowClicked(rowKey: string) {
        if (expandedRows.has(rowKey)) {
            expandedRows.delete(rowKey)
        } else {
            expandedRows.add(rowKey)
        }
        setExpandedRows(new Set(expandedRows)) // new copy of Set, otherwise useState will ignore the update
    }

    function columnClicked(clickedColumn: number) {
        if (sortColumn !== clickedColumn) {
            setSortColumn(clickedColumn)
            setSortDirection("ascending")
        } else {
            setSortDirection(sortDirection === "ascending" ? "descending" : "ascending")
        }
    }

    function sortKey(a: RowData) {
        if (!a.cells) {
            return ""
        }
        const cell1 = a.cells[sortColumn]
        if (!cell1) {
            return ""
        }
        if (typeof (cell1) === "string") {
            return cell1
        } else {
            return cell1.sortKey || cell1.text || cell1.icon || cell1.color || ""
        }
    }
    const sortDirectionNum = sortDirection === "ascending" ? 1 : -1
    function sortFunc(a: RowData, b: RowData) {
        const ka = sortKey(a)
        const kb = sortKey(b)
        // console.log("sortFunc", a, b)
        // console.log("ka", ka)
        // console.log("kb", kb)
        const na = parseFloat(ka)
        const nb = parseFloat(kb)
        if (!isNaN(na) && !isNaN(nb)) {
            // sort numbers
            if (na == nb) {
                return 0
            } else if (na < nb) {
                return -1 * sortDirectionNum
            } else {
                return 1 * sortDirectionNum
            }
        } else if (!ka && !kb) {
            return 0
        } else if (!ka) {
            // nulls go last
            return 1
        } else if (!kb) {
            // nulls go last
            return -1
        } else {
            // sort strings
            return ka.localeCompare(kb) * sortDirectionNum
        }
    }
    const rows = data.rows || []
    const rowsSorted = isNaN(sortColumn) ? rows : rows.sort(sortFunc)
    // const rowsSorted = sortDirection === "ascending" ? rowsSorted1 : rowsSorted1.reverse()

    return (
        <>
            {data.title && <Header as={headingType || "h3"}>{data.title}</Header>}

            {data.text &&
                <pre style={{ width: "90vw", overflowX: "auto", whiteSpace: "pre-wrap" }}>
                    {data.text}
                </pre>
            }

            {data.buttons && data.buttons.map(b => (
                <ButtonWithPopups key={b.text} {...b} />
            ))}

            {data.json && <JsonViewer data={data.json} />}

            <Table celled collapsing selectable sortable structured>
                <Table.Header>
                    <Table.Row>
                        {(data.fields || []).map((field, fi) => (
                            <Table.HeaderCell
                                key={fi}
                                rowSpan={fieldColSpans[fi] ? undefined : '2'}
                                colSpan={fieldColSpans[fi]}
                                sorted={sortColumn === fi ? sortDirection : undefined}
                                onClick={() => columnClicked(fi)}
                            >
                                {field}
                            </Table.HeaderCell>
                        ))}
                    </Table.Row>
                    {data.fields2 &&
                        <Table.Row>
                            {data.fields2.map((field, fi) => (
                                <Table.HeaderCell key={fi}>
                                    {field}
                                </Table.HeaderCell>
                            ))}
                        </Table.Row>
                    }
                </Table.Header>
                <Table.Body>
                    {rowsSorted.map(row => (
                        <React.Fragment key={row.key}>
                            <Table.Row onClick={() => onRowClicked(row.key)} style={{ cursor: row.getExpandedDetail ? 'pointer' : undefined }} >
                                {row.cells.map((cell, ci) => <DataCellRender key={ci} cell={cell} />)}
                            </Table.Row>
                            {expandedRows.has(row.key) && row.getExpandedDetail &&
                                <Table.Row>
                                    <Table.Cell colSpan={row.cells.length}>
                                        <ExpandedRowCell getExpandedDetail={row.getExpandedDetail} scriptName={scriptName} />
                                    </Table.Cell>
                                </Table.Row>
                            }
                        </React.Fragment>
                    ))}
                </Table.Body>
            </Table>
        </>
    )
}

function ButtonWithPopups(props: ButtonInfo) {

    const [popupText, setPopupText] = React.useState<string | null>(null);

    const button = (
        <Button onClick={() => props.onClicked(setPopupText)}>
            {props.text}
        </Button>
    )

    if (popupText == null) {
        return button
    } else {
        return (
            <Popup
                content={popupText}
                trigger={button}
                on='hover'
            />
        )
    }
}

function JsonViewer(props: { data: any }) {


    const panes = [
        {
            menuItem: 'Inspector', render() {
                return (
                    <div style={{ marginTop: "0.5em" }}>
                        <ReactJsonInspector
                            data={typeof (props.data) == "string" ? JSON.parse(props.data) : props.data}
                            isExpanded={() => true}
                        />
                    </div>
                )
            }
        },
        {
            menuItem: 'JSON', render() {
                const str = typeof (props.data) === "string" ? props.data : JSON.stringify(props.data, null, 2);
                // return <pre>{str}</pre>
                // return <Highlight language="json">{str}</Highlight>
                return <JsonHighlighter data={props.data} />
            }
        },
        {
            menuItem: 'Simple', render() {
                const str = typeof (props.data) === "string" ? props.data : JSON.stringify(props.data, null, 2);
                return <pre>{str}</pre>
            }
        },
    ]

    return <Tab style={{ margin: "0.5em" }} panes={panes} />;
}

function JsonHighlighter(props: { data: any }) {
    const str = typeof (props.data) === "string" ? props.data : JSON.stringify(props.data, null, 2);
    return (
        <Highlight {...defaultProps} theme={github} code={str} language="json">
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <pre className={className} style={style}>
                    {tokens.map((line, i) => (
                        <div {...getLineProps({ line, key: i })}>
                            {line.map((token, key) => (
                                <span {...getTokenProps({ token, key })} />
                            ))}
                        </div>
                    ))}
                </pre>
            )}
        </Highlight>
    )
}

interface RunCommandStatusProps {
    cmdName: string
    args: string[]
    httpStatus?: number
    result?: string
}
function RunCommandStatus(props: RunCommandStatusProps) {
    const { cmdName, args, httpStatus, result } = props
    return (
        <Table.Row>
            <Table.Cell>{cmdName} {args.join(" ")}</Table.Cell>
            {httpStatus && <Table.Cell title={result}>{httpStatus}</Table.Cell>}
            {!httpStatus && <Table.Cell><Icon loading name='spinner' /></Table.Cell>}
        </Table.Row>
    )
}
function RunCommandData({ commands }: { commands: RunCommandStatusProps[] }) {
    const stillRunning = commands.filter(c => !c.httpStatus)
    const allDone = stillRunning.length === 0

    function formatIfJson(str: any) {
        try {
            return JSON.stringify(JSON.parse(str), null, 2)
        } catch {
            return str
        }
    }

    if (allDone) {
        const level2panels = commands.map((cmd, i) => ({
            key: i,
            title: `${cmd.cmdName} (${cmd.args.join(" ")})`,
            content: { content: <div><pre>{formatIfJson(cmd.result) || "[empty]"}</pre></div> },
        }))
        const Level1Content = (
            <div>
                <Accordion.Accordion panels={level2panels} />
            </div>
        )
        return (
            <Accordion panels={[{
                key: "rawData",
                title: "Raw data",
                content: { content: Level1Content },
            }]} />
        )
    } else {
        return (
            <>
                <h2>Running commands...</h2>
                <Progress
                    value={commands.length - stillRunning.length} total={commands.length}
                    progress="ratio"
                    style={{ width: "50%" }}
                />
                <Table compact collapsing>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Command</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {commands.map((commandStatus, i) => <RunCommandStatus key={i} {...commandStatus} />)}
                    </Table.Body>
                </Table>
            </>
        )
    }
}

function useData(scriptName: string, loader: Promise<LoadFunction>) {
    const [commands, setCommands] = React.useState<RunCommandStatusProps[]>([])
    const [settings, setSettings] = React.useState<Settings | null>(null)
    const [dataList, setDataList] = React.useState<Data[] | null>(null)
    const [modalData, setModalData] = React.useState<Data | null>(null)
    const [error, setError] = React.useState<unknown | null>(null)
    function setData(data: Data | Data[]) {
        setDataList(Array.isArray(data) ? data : [data])
    }

    React.useEffect(() => {
        // console.log("in useEffect")
        async function fetchData() {
            async function runCommand(cmdName: string, ...args: string[]) {
                const commandStatus: RunCommandStatusProps = { cmdName, args }
                setCommands(commands => [...commands, commandStatus])

                const argStr = args.map(arg => `&arg=${arg}`).join("")
                const resp = await fetch(`/run?script=${scriptName}&cmd=${cmdName}${argStr}`)
                const rawData = await resp.text()
                commandStatus.httpStatus = resp.status

                commandStatus.result = rawData
                setCommands(commands => [...commands])
                if (!resp.ok) {
                    throw new Error(`command failed: ${cmdName} ${args.join(" ")}: ${rawData}`)
                }
                return rawData
            }

            if (document.visibilityState && document.visibilityState == "visible") {
                // only if window visible (e.g. not in background tab)
                const args: LoadFunctionArgs = {
                    setData,
                    settings: settings || {},
                    runCommand,
                    showModal: setModalData,
                    setClipboard(str) {
                        window.navigator.clipboard.writeText(str)
                    },
                    debug: console.debug,
                    error: console.error,
                    warn: console.warn,
                }
                try {
                    const loadFunction = await loader
                    await loadFunction(args)
                } catch (err) {
                    console.error("loadFunction failed", err)
                    setError(err)
                }
            }
            // setTimeout(fetchData, 5000)
        }

        fetchData()

        return (() => { console.log("demounting") })
    }, [settings])

    return { error, dataList, modalData, setModalData, settings, setSettings, commands }
}

interface ScriptPanelProps {
    scriptName: string
}
function ScriptPanel(props: ScriptPanelProps) {
    const { scriptName } = props
    document.title = props.scriptName

    async function dynamicPanelLoader() {
        const loader = await import("/loader-for-script/" + scriptName)
        return loader.load
    }

    const { error, dataList, commands, settings, setSettings } = useData(scriptName, dynamicPanelLoader())

    if (error) {
        return <ErrorDisplay error={error} />
    }

    if (!dataList) {
        return <RunCommandData {...{ commands }} />
    }

    const defaultSettings = (dataList || []).flatMap(x => Object.entries(x.defaultSettings || {}))

    return (
        <>
            <div style={{ display: "flex" }}>
                <Popup
                    trigger={<Icon circular size='small' name='angle down' style={{ fontSize: "small" }} />}
                    content={<ScriptsList />}
                    hoverable
                    size='small'
                />
                <span style={{ fontSize: "x-large", fontWeight: "bold", margin: "0 1em 0 0.5em" }}>{props.scriptName}</span>
                {defaultSettings.length > 0 &&
                    <Popup
                        trigger={<Icon circular size='small' name='settings' style={{ fontSize: "small" }} />}
                        content={<OptionsEditor {...{ defaultSettings, settings, setSettings }} />}
                        hoverable
                        size='small'
                    />
                }
            </div>


            {dataList.map((data, i) => <DataTableRender key={i} {...{ data, scriptName: scriptName }} />)}

            <RunCommandData {...{ commands }} />
        </>
    )
}

interface OptionEditorProps {
    defaultSettings: [string, string | number | boolean][]
    settings: Settings | null
    setSettings: React.Dispatch<React.SetStateAction<Settings | null>>
}
function OptionsEditor(props: OptionEditorProps) {
    const settings = props.settings || {}

    const onChange = (event: React.FormEvent<HTMLInputElement>, data: CheckboxProps) => {
        const newSettings = { ...settings, [data.id + '']: data.checked || false }
        props.setSettings(newSettings)
    }

    return (
        <div>
            {props.defaultSettings.map(([key, defaultValue]) => {
                const setValue = settings[key]
                const value = setValue == null ? defaultValue : setValue
                console.log("OptionsEditor", key, value)
                return (
                    <div key={key}>
                        <Checkbox label={key} id={key} checked={!!value} onChange={onChange} />
                    </div>
                    // <div>
                    //     <div>{key}</div>
                    //     <div>{value}</div>
                    // </div>
                )
            })}
        </div>
    )
}

function App() {
    const url = new URL(window.location.href)
    const segments = url.pathname.split('/')
    console.log("App route:", segments)
    if (segments[1] == "script") {
        return <ScriptPanel scriptName={segments[2]} />

    } else if (!segments[1]) {
        return <ScriptsList />
    } else {
        return <div>invalid url: {url}</div>
    }
}

interface ScriptsInfo {
    scripts: string[]
}
function ScriptsList() {

    const [data, setData] = React.useState<ScriptsInfo | null>(null)

    React.useEffect(() => {

        async function fetchData() {
            const resp = await fetch('/scripts')
            const scripts = await resp.json()
            console.log("available scripts:", scripts)
            setData(scripts)
        }
        fetchData()

    }, [])

    if (data) {
        return (
            <Container>
                <Header>Panels</Header>
                <List>
                    {data.scripts.map(script =>
                        <List.Item icon='linkify' content={<a href={'/script/' + script}>{script}</a>} key={script} />)}
                </List>
            </Container>
        )
    } else {
        return <Loader inline active />
    }
}



class ErrorBoundary extends React.Component<{}, { error: any }> {
    constructor(props: {}) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: any) {
        // Update state so the next render will show the fallback UI.
        return { error };
    }

    componentDidCatch(error: any, info: any) {
        // Example "componentStack":
        //   in ComponentThatThrows (created by App)
        //   in ErrorBoundary (created by App)
        //   in div (created by App)
        //   in App
        console.error(info.componentStack);
    }

    render() {
        if (this.state.error) {
            return <ErrorDisplay error={this.state.error} />
        } else {
            return this.props.children;
        }
    }
}
function ErrorDisplay(props: { error: any }) {
    return (
        <>
            <h1>Error</h1>
            <pre>
                {props.error.toString()}
            </pre>
        </>
    );
}


ReactDOM.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>,
    document.getElementById("react-root")
)
