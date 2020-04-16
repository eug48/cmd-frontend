
/// <reference path="../../frontend/types.d.ts" />

const allKeys = new Set()

/**
 * @param args {LoadFunctionArgs}
 */
export async function load({ runCommand, setData, settings, debug, warn, error }) {

    const listRaw = await runCommand("list")
    // @ts-ignore
    // const filter = new URLSearchParams(window.location.search).get('filter')

    const names = []
    const displayNames = []
    const states = []
    for (const line of listRaw.split("\n")) {
        const prefix1 = "SERVICE_NAME: "
        if (line.startsWith(prefix1)) {
            names.push(line.substr(prefix1.length))
        }

        const prefix2 = "DISPLAY_NAME: "
        if (line.startsWith(prefix2)) {
            displayNames.push(line.substr(prefix2.length))
        }

        const state = line.match(/^\s+STATE\s+: \d\s*(.+)/)
        if (state) {
            const text = state[1].toLowerCase().trim()
            if (text == "running") {
                states.push({
                    icon: "play",
                    color: "green",
                    text,
                })
            } else if (text == "stopped") {
                states.push({
                    icon: "stop",
                    color: "yellow",
                    text,
                })
            } else {
                states.push(text)
            }
        }
    }

    const rows = names.map((name, i) => ({
        cells: [name, displayNames[i], states[i]],
        key: name,
        async getExpandedDetail({ runCommand, setData }) {

            const description = await showDescription(runCommand, name)
            const config = await showServiceConfig(runCommand, name)
            const securityDescriptorSections = await showSecurityDescriptor(runCommand, name)
            setData([description, ...config, ...securityDescriptorSections])
        },
    }))

    setData({
        rows,
        fields: ["Name", "Display name", "State"],
    })
}

async function showDescription(runCommand, serviceName) {
    const output = await runCommand("queryDescription", serviceName)

    let description = ""
    for (const line of output.split("\n")) {
        const prefix1 = "DESCRIPTION: "
        if (line.startsWith(prefix1)) {
            description = line.substr(prefix1.length)
            break
        }
    }

    return { title: "Description", text: description, }
}

async function showServiceConfig(runCommand, serviceName) {
    const output = await runCommand("queryConfig", serviceName)
    let path = ""

    for (const line of output.split("\n")) {
        const pathMatch = line.match(/^\s+BINARY_PATH_NAME\s+:\s*(.+)/)
        if (pathMatch) {
            path = pathMatch[1]
            break
        }
    }

    return [
        {
            title: "Path",
            text: path,
        }
    ]
}

async function showSecurityDescriptor(runCommand, serviceName) {

    const sdshow = await runCommand("sdshow", serviceName)
    const sd = sdshow.split("\r\n").filter(x => x).reverse()[0]

    // https://docs.microsoft.com/en-us/windows/win32/secauthz/security-descriptor-string-format
    // https://docs.microsoft.com/en-us/windows/win32/secauthz/ace-strings
    const sectionTables = []
    const sections = sd.split(/(?=[A-Z]:)/g)
    for (const section of sections) {

        const [sectionTypeCode, ACL] = section.split(":")
        const sectionType = section_types[sectionTypeCode] || sectionTypeCode

        const ACEs = ACL.substr(1, ACL.length - 2).split(")(")
        const rows = []

        for (const ACE of ACEs) {

            const [ace_type_code, ace_flags, rights_codes, object_guid, inherit_object_guid, account_code, resource_attribute] = ACE.split(";")
            const aceType = ace_types[ace_type_code] || ace_type_code
            const account = sid_names[account_code] || account_code

            // const rights =
            //     Array.from(rights_codes.matchAll(/../g))
            //         .map(code => ({ cells: [aceType, account, rights_code_to_string(code)] }))
            // rows.push(rights)

            const rights = Array.from(rights_codes.matchAll(/../g)).map(code => rights_code_to_string(code))

            rows.push({
                cells: [aceType, account, rights.join(", ")],
                key: ace_type_code + account_code + rights_codes,
            })

        }
        sectionTables.push({
            // title: `${sectionType} - ${aceType} - ${account}`,
            title: `${sectionType}`,
            rows: rows.flat(),
            fields: ["type", "account", "right"]
        })
    }

    return sectionTables
}


const section_types = {
    "D": "DACL",
    "S": "SACL",
}

const ace_types = {
    "A": "Allow",
    "D": "Deny",
}

const sid_names = {
    "AN": "Anonymous",
    "AO": "Account operators",
    "AU": "Authenticated users",
    "BA": "Built-in administrators",
    "BG": "Built-in guests",
    "BO": "Backup operators",
    "BU": "Built-in users",
    "CA": "SDDL_CERT_SERV_ADMINISTRATORS",
    "CD": "SDDL_CERTSVC_DCOM_ACCESS",
    "CG": "Creator group",
    "CO": "Creator owner",
    "DA": "Domain administrators",
    "DC": "Domain computers",
    "DD": "Domain controllers",
    "DG": "Domain guests",
    "DU": "Domain users",
    "EA": "Enterprise administrators",
    "ED": "Enterprise domain controllers",
    "HI": "High integrity level",
    "IU": "Interactively logged-on user",
    "LA": "Local administrator",
    "LG": "Local guest",
    "LS": "Local service",
    "LW": "Low integrity level",
    "ME": "Medium integrity level",
    "MU": "Performance Monitor users",
    "NO": "Network configuration operators",
    "NS": "Network service",
    "NU": "Network logon user",
    "PA": "Group Policy administrators",
    "PO": "Printer operators",
    "PS": "Principal self",
    "PU": "Power users",
    "RC": "Restricted code",
    "RD": "Terminal server users",
    "RE": "Replicator",
    "RO": "Enterprise Read-only domain controllers",
    "RS": "RAS servers group",
    "RU": "SDDL_ALIAS_PREW2KCOMPACC",
    "SA": "Schema administrators",
    "SI": "System integrity level",
    "SO": "Server operators",
    "SU": "Service logon user",
    "SY": "Local system",
    "WD": "Everyone",
}


const service_rights = {
    "Query config": 0x0001,
    "Change config": 0x0002,
    "Query status": 0x0004,
    "Enumerate dependents": 0x0008,
    "Start": 0x0010,
    "Stop": 0x0020,
    "Pause/continue": 0x0040,
    "Interrogate": 0x0080,
    "User defined control": 0x0100,
}
for (const [k, v] of Object.entries(service_rights)) {
    service_rights[v] = k
}

// https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-dtyp/f4296d69-1c0f-491f-9587-a960b292d070

const rights_to_hex = {

    "GR": 0x80000000,
    "GW": 0x40000000,
    "GX": 0x20000000,
    "GA": 0x10000000,

    "WO": 0x00080000,
    "WD": 0x00040000,
    "RC": 0x00020000,
    "SD": 0x00010000,

    "FA": 0x001F01FF,
    "FX": 0x001200A0,
    "FW": 0x00120116,
    "FR": 0x00120089,

    "KA": 0x000F003F,
    "KR": 0x00020019,
    "KX": 0x00020019,
    "KW": 0x00020006,

    "CR": 0x00000100,
    "LO": 0x00000080,
    "DT": 0x00000040,
    "WP": 0x00000020,
    "RP": 0x00000010,
    "SW": 0x00000008,
    "LC": 0x00000004,
    "DC": 0x00000002,
    "CC": 0x00000001,
}


const rights_strings = {
    // Generic access rights
    "GA": "GENERIC_ALL",
    "GR": "GENERIC_READ",
    "GW": "GENERIC_WRITE",
    "GX": "GENERIC_EXECUTE",

    // Standard access rights
    "RC": "Read control",
    "SD": "Delete",
    "WD": "Write DAC",
    "WO": "Write Owner",

    // Directory service object access rights,
    "RP": "READ_PROPERTY",
    "WP": "WRITE_PROPERTY",
    "CC": "CREATE_CHILD",
    "DC": "DELETE_CHILD",
    "LC": "LIST_CHILDREN",
    "SW": "SELF_WRITE",
    "LO": "LIST_OBJECT",
    "DT": "DELETE_TREE",
    "CR": "CONTROL_ACCES",

    // File access rights
    "FA": "FILE_ALL_ACCESS",
    "FR": "FILE_GENERIC_READ",
    "FW": "FILE_GENERIC_WRITE",
    "FX": "FILE_GENERIC_EXECUTE",

    // Registry key access rights
    "KA": "KEY_ALL_ACCESS",
    "KR": "KEY_READ",
    "KW": "KEY_WRITE",
    "KX": "KEY_EXECUTE",

    // Mandatory label rights
    "NR": "SYSTEM_MANDATORY_LABEL_NO_READ_UP",
    "NW": "SYSTEM_MANDATORY_LABEL_NO_WRITE_UP",
    "NX": "SYSTEM_MANDATORY_LABEL_NO_EXECUTE_UP",
}

function rights_code_to_string(code) {
    const hex = rights_to_hex[code]
    if (code) {
        const service_string = service_rights[hex]
        if (service_string) {
            return service_string
        }
    }

    const str = rights_strings[code]
    if (str) {
        return str
    }

    return code
}