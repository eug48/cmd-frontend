import { Loader, Container, List, Header, Table, Icon, SemanticICONS, Accordion, Popup, Progress, Button, Modal, Tab, Checkbox, CheckboxProps, Dropdown, DropdownProps, TextArea, Input } from '/js/web_modules/semantic-ui-react.js';
import { SemanticCOLORS } from 'semantic-ui-react/dist/commonjs/generic';

// @ts-ignore
import JsonViewer from '/js/JsonViewer.js';

declare var React: typeof import("react");
declare var ReactDOM: typeof import("react-dom");

interface DataCellProps {
    cell?: DataCell
    col: number
}
function DataCellRender({ cell, col }: DataCellProps) {
    if (typeof (cell) === "string" || typeof(cell) === "number") {
        if (col == 0) {
            // <a> added to enable hinting in qutebrowser/tridactyl/etc
            return <Table.Cell><a>{cell}</a></Table.Cell> 
        } else {
            return <Table.Cell>{cell}</Table.Cell>
        }
    } else if (cell == null) {
        return <Table.Cell></Table.Cell>
    } else if (Array.isArray(cell)) {
        return <Table.Cell>{cell.map( (str, i) => <div key={i}>{str}</div>)}</Table.Cell>
    } else {
        const { text, url, warning, color, icon, tooltip, bold } = cell
        const content =
            url
            ? <a href={url} target='_blank'>{text}</a>
            : text
        return (
            <Table.Cell {...{ warning }} title={tooltip}>
                {warning && <Icon name='attention' />}
                {icon && <Icon name={icon as SemanticICONS} color={color as SemanticCOLORS} />}
                {bold && <b>{content}</b>}
                {!bold && content}
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
                content={<DataTableRender data={modalData} key="m" scriptName={scriptName} searchText="" />}
                onClose={() => setModalData(null)}
                open
                size="fullscreen"
                closeOnEscape
            />
        )
    }

    console.log("dataList", dataList)

    return (
        <>
            {dataList.map((data, i) => <DataTableRender key={i} {...{ data, scriptName }} headingType="h4" searchText="" />)}
        </>
    )
}

interface DataTableProps {
    data: Data
    searchText: string
    scriptName: string
    headingType?: "h3" | "h4"
}
function DataTableRender(props: DataTableProps) {
    const { scriptName: scriptName, data, searchText, headingType } = props
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
    function filterRows(rows: RowData[]) {
        if (!searchText) {
            return rows
        } else {
            const regex = new RegExp(searchText, "i") // case insensitive
            return rows.filter(row => {
                for (const cell of row.cells) {
                    if (typeof(cell) == "string") {
                        if(regex.test(cell)) {
                            return true
                        }
                    } else if (cell) {
                        if (cell.text && regex.test(cell.text)) {
                            return true
                        }
                        if (cell.tooltip && regex.test(cell.tooltip)) {
                            return true
                        }
                    }
                }
                return false
            })
        }
    }
    const rows = filterRows(data.rows || [])
    const rowsSorted = isNaN(sortColumn) ? rows : rows.sort(sortFunc)
    // const rowsSorted = sortDirection === "ascending" ? rowsSorted1 : rowsSorted1.reverse()

    let jsonViewer: React.ReactElement | null = null
    if (data.json) {
        // TODO: would be nice to load lazily but it's much slower and causes rendering glitches..
        // const JsonViewer = React.lazy(() => import('/js/JsonViewer.js'));
        jsonViewer = (
            // <React.Suspense fallback={<div style={{ height: "100%" }}></div>}>
            <JsonViewer data={data.json} />
            // </React.Suspense>
        )
    }

    return (
        <>
            {data.title && <Header as={headingType || "h3"}>{data.title}</Header>}

            {data.text &&
                // <pre style={{ width: "90vw", overflowX: "auto", whiteSpace: "pre-wrap" }}>
                <pre style={{ margin: "1em", whiteSpace: "pre-wrap" }}>
                    {data.text}
                </pre>
            }

            {data.buttons && data.buttons.map(b => (
                <ButtonWithPopups key={b.text} {...b} />
            ))}

            {jsonViewer}

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
                                title={(typeof(field) == "object") ? field.tooltip : undefined}
                            >
                                {typeof(field) == "object" ? field.text : field}
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
                    {rowsSorted.length == 0 && data.fields && <Table.Row><Table.Cell colSpan={data.fields.length}>none</Table.Cell></Table.Row>}
                    {rowsSorted.map(row => (
                        <React.Fragment key={row.key}>
                            <Table.Row onClick={() => onRowClicked(row.key)} style={{ cursor: row.getExpandedDetail ? 'pointer' : undefined }} >
                                {row.cells.map((cell, i) => <DataCellRender key={i} col={i} cell={cell} />)}
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
    if (commands.length == 0) {
        return null
    }
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
            title: cmd.cmdName + (cmd.args.length > 0 ? ("(" + cmd.args.join(" ") + ")") : ""),
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

const RefreshContext = React.createContext(new Date())

function useData(scriptName: string, loader: Promise<LoadFunction>) {
    const [commands, setCommands] = React.useState<RunCommandStatusProps[]>([])
    const [settings, setSettings] = React.useState<Settings | null>(null)
    const [dataList, setDataList] = React.useState<Data[] | null>(null)
    const [modalData, setModalData] = React.useState<Data | null>(null)
    const [error, setError] = React.useState<unknown | null>(null)
    const lastRefreshed = React.useContext(RefreshContext)

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
                    // FIXME 01: if the load function dynamic import fails to load
                    // this catch statement doesn't fire.. (neither does Promise.catch..)
                    console.error("loadFunction failed", err)
                    setError(err)
                }
            }
            // setTimeout(fetchData, 5000)
        }

        fetchData()

        // return (() => { console.log("demounting") })

    }, [settings, lastRefreshed])

    return {
        dataList, commands, error,
        modalData, setModalData,
        settings, setSettings,
    }
}

interface ScriptPanelProps {
    scriptName: string
    lastRefreshed: Date
    refresh: () => void
}
function ScriptPanel(props: ScriptPanelProps) {
    const { scriptName } = props
    document.title = props.scriptName

    function dynamicPanelLoader() {
        const loader = import("/loader-for-script/" + scriptName)
        return loader.then(module => module.load)
    }

    const { error, dataList, commands,
        settings, setSettings } = useData(scriptName, dynamicPanelLoader())
    const searchParams = new URLSearchParams(window.location.search)
    const [searchText, setSearchText] = React.useState(searchParams.get("search") || "")

    if (error) {
        return <ErrorDisplay error={error} />
    }

    if (!dataList) {
        if (commands.length == 0) {
            // FIXME, see 01
            return <a href="/">Script not found? Check F12 console. Click here to go back to the panel list.</a>
        } else {
            return <RunCommandData {...{ commands }} />
        }
    }

    const defaultSettings = (dataList || []).flatMap(x => Object.entries(x.defaultSettings || {}))

    return (
        <>
            <div style={{ display: "flex" }}>
                <Popup
                    trigger={<Icon circular size='small' name='angle down' style={{ fontSize: "small" }} />}
                    content={<ScriptsList showHeading={false} />}
                    hoverable
                    size='small'
                />
                <Icon
                    circular size='small' name='refresh' style={{ fontSize: "small", marginLeft: "1em" }}
                    title={`Refreshed ${props.lastRefreshed.toLocaleTimeString()}`}
                    onClick={props.refresh}
                />
                <span style={{ fontSize: "x-large", fontWeight: "bold", margin: "0 1em 0 0.5em" }}>
                    {props.scriptName.replace("-", " - ").replace(/%20/g, ' ')}
                </span>
                {defaultSettings.length > 0 &&
                    <Popup
                        trigger={<Icon circular size='small' name='settings' style={{ fontSize: "small", marginRight: "1em" }} />}
                        content={<OptionsEditor {...{ defaultSettings, settings, setSettings }} />}
                        hoverable
                        flowing
                        size='small'
                    />
                }
                <Input type="text" icon="search" size="small" rows="1"
                    autoFocus
                    value={searchText}
                    onChange={(_, c) => setSearchText(c.value)}
                />
            </div>


            {dataList.map((data, i) => <DataTableRender key={i} {...{ data, searchText, scriptName: scriptName }} />)}

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
                // console.log("OptionsEditor", key, value)
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
    const scriptName = segments[2]

    const [lastRefreshed, setLastRefreshed] = React.useState<Date>(new Date())
    function refresh() {
        setLastRefreshed(new Date())
    }

    if (segments[1] == "script") {
        return (
	    <RefreshContext.Provider value={lastRefreshed}>
                <ScriptPanel {...{scriptName, refresh, lastRefreshed}} />
	    </RefreshContext.Provider>
        )
    } else if (!segments[1]) {
        return <ScriptsList showHeading />
    } else {
        return <div>invalid url: {url}</div>
    }
}

interface ScriptsInfo {
    scripts: string[]
}
function ScriptsList(props: { showHeading: boolean }) {

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
            <Container style={{ fontSize: "x-large"}}>
                {props.showHeading && <Header>Panels</Header>}
                <List>
                    {data.scripts.map(script =>
                        <List.Item icon='linkify' content={<a href={'/script/' + script}>{script.replace("-", " - ")}</a>} key={script} />)}
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
