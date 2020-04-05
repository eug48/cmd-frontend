// Scripts export a LoadFunction named load
type LoadFunction = (args: LoadFunctionArgs) => void

interface LoadFunctionArgs {
    // Lets scripts run commands that are whitelisted on the server/backend in .cmd files alongside the script's .js file
    runCommand(cmd: string, ...args: string[]): Promise<string>

    // Settings that have been set by the user (e.g. show/hide a column)
    settings: Settings,

    // Used by scripts to display data
    setData(data: Data | Data[]): void

    // Scripts can show modal data
    showModal(data: Data): void

    // Scripts can set clipboard, e.g. with commands after a button click (e.g. kubectl delete ...)
    // (FIXME TODO: is this dangerous? should user give consent?)
    setClipboard(str: string): void

    // logging outputs
    debug(...args: any): void
    warn(...args: any): void
    error(...args: any): void
}


interface Data {
    title?: string
    text?: string
    json?: unknown

    /* Tables */

    // fields are table columns
    fields?: FieldInfo[]

    // these are sub-colu,ms
    fields2?: FieldInfo[]

    fieldColSpans?: number[]

    rows?: RowData[]

    // buttons to show above tables
    buttons?: ButtonInfo[]

    // settings that users can change, along with defaults
    defaultSettings?: Settings
}

type FieldInfo = string

interface RowData {
    cells: DataCell[]
    key: string

    // called when users click on a row
    getExpandedDetail?: LoadFunction
}
type DataCell = string | CellInfo
interface CellInfo {
    text?: string
    url?: string
    tooltip?: string
    sortKey?: string

    warning?: boolean
    bold?: boolean
    icon?: string
    color?: string
}

interface ButtonInfo {
    text: string
    onClicked: (showTooltip?: (text: string) => void) => void;
}

interface Settings {
    [name: string]: boolean | number | string
}