/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load(args) {
    const { runCommand, setData, debug, warn, error } = args

    const text = await runCommand("list-by-size-dpkg")
    const packages = []
    let curPackage = {}
    let curLongDescription = ""
    function addEntry() {
        if (Object.keys(curPackage).length > 0) {
            curPackage.longDescription = curLongDescription
            packages.push(curPackage)
        }
    }
    for (const line of text.split("\n")) {
        if (line.startsWith(">>>")) {
            addEntry()
            const [size, name, arch, shortDescription] = line.split("\t")
            curPackage = { name, arch, shortDescription, size: parseInt(size.substr(3)) }
            curLongDescription = ""
        } else {
            if (line.trim() == ".") {
                curLongDescription += "\n"
            } else {
                curLongDescription += line + "\n"
            }
        }
    }
    addEntry()

    async function* extractData() {

        for (const { name, arch, size, shortDescription, longDescription } of packages) {
            yield {
                cells: [name, arch, size, shortDescription],
                key: name + arch,
                sortKey: size,
                /**
                 * @param args {LoadFunctionArgs}
                 */
                async getExpandedDetail({ runCommand, setData }) {
                    // show output of
                    // kubectl get -o wide
                    //const text = await runCommand("resource-list", kind)
                    //const table = parseKubectlWideOutput(text)
                    const filesText = await runCommand("list-files-dpkg", name)
                    const files = filesText.split("\n")
                    setData([
                        {
                            text: longDescription,
                            fields: ["File", "Size"],
                            // filter out directories
                            rows: files.filter(s => s).map(row => row.split(' ')).filter(row => (parseInt(row[0], 16) & 0o170000) != 0o040000).map(([mode, name, size]) => ({
                                key: name,
                                cells: [name, size],
                                /**
                                 * @param args {LoadFunctionArgs}
                                 */
                                async getExpandedDetail({ runCommand, setData }) {
                                    const text = await runCommand("read-file", btoa(name))
                                    setData({ text })
                                },
                            }))
                        }
                    ])
                }
            }

        }
    }

    setData({
        fields: [ "Name", "Architecture", "Size", "Description"],
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


// vim: et sw=4 ts=4 et
