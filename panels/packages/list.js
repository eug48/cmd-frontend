/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load(args) {
    const { runCommand, setData, debug, warn, error } = args

    const text = await runCommand("list-by-size")
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
            const [size, name, version, arch, shortDescription] = line.split("\t")
            curPackage = { name, version, arch, shortDescription, size: parseInt(size.substr(3)) }
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

    function* extractData() {

        for (const { name, version, arch, size, shortDescription, longDescription } of packages) {

            const sizeInt = parseInt(size, 10)
            const sizeCell = { text: formatFileSize(sizeInt), sortKey: size }
            yield {
                cells: [name, version, arch, sizeCell, shortDescription],
                key: name + version + arch,
                sortKey: sizeInt,
                /**
                 * @param args {LoadFunctionArgs}
                 */
                async getExpandedDetail({ runCommand, setData }) {
                    const filesText = await runCommand("list-files", name)
                    const files = filesText.split("\n")
                    function loadLine(line) {
                        if (!line) {
                            return
                        }
                        if (line.startsWith('stat')) {
                            return [line, 0]
                        }
                        const row = line.split(' ')
                        const mode = parseInt(row[0], 16) 
                        if ((mode & 0o170000) == 0o040000) {
                            return // is a directory
                        }
                        return [row[1], parseInt(row[2], 10)]
                    }
                    setData([
                        {
                            text: longDescription,
                            fields: ["File", "Size"],
                            // filter out directories
                            rows: files.map(loadLine).filter(s => s).map(([name, size]) => ({
                                key: name,
                                cells: [name, { text: formatFileSize(size), sortKey: size } ],
                                sortKey: size,
                                /**
                                 * @param args {LoadFunctionArgs}
                                 */
                                async getExpandedDetail({ runCommand, setData }) {
                                    const text = await runCommand("read-file", btoa(name))
                                    setData({ text })
                                },
                            })).sort( (a, b) => b.sortKey - a.sortKey)
                        }
                    ])
                }
            }

        }
    }

    const rows = toArray(extractData())
    rows.sort( (a, b) => b.sortKey - a.sortKey)

    setData({
        fields: [ "Name", "Version", "Architecture", "Size", "Description"],
        rows,
    })
}
function toArray(source) {
    let items = []
    for (const item of source) {
        items.push(item)
    }
    return items
}

/**
 * Formats number of bytes to string with MB, GB, etc
 * from Andrew V. https://stackoverflow.com/a/20732091
 * @param {number|string} bytes
 */
function formatFileSize(bytes) {
    if (typeof(bytes) == "string") {
        bytes = parseInt(bytes, 10)
    }
    if (bytes == 0) {
        return "0"
    }
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return ( bytes / Math.pow(1024, i) ).toFixed(2) + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
};


// vim: et sw=4 ts=4 et
