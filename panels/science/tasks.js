/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load({ runCommand, setData }) {

    const rows = await loadBOINC(runCommand);

    setData({
        fields: ["System", "Name", "Deadline", "Files", "Scheduler", "Status", "Completion"],
        rows,
    })
}

async function loadBOINC(runCommand) {
    const text = await runCommand("boinc")
    const sections = parseBoincGetState(text)

    console.log(text, sections)
    const tasks = sections["Tasks"]

    const rows = tasks.map(task => {
        const deadline = task["report deadline"]
        const state = task["state"]
        const schedulerState = task["scheduler state"]
        const taskState = task["active_task_state"]
        const completion = parseFloat(task["fraction done"]) * 100 + '%'
        return {
            cells: ["BOINC", task.name, deadline, state, schedulerState, taskState, completion],
            key: task.name,
            getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {
                setData({
                    json: task
                })
            }
        }
    })

    return rows
}

/**
 * @param {string} text
 */
function parseBoincGetState(text) {
    let sections = {}
    let section = ""
    let item = {}

    function saveItem() {
        if (Object.keys(item).length > 0) {
            const existing = sections[section] || []
            if (existing.length == 0) {
                sections[section] = existing
            }
            existing.push(item)
            item = {}
        }
    }

    const lines = text.split("\n")
    for (const line of lines) {
        if (line.startsWith("==")) {
            // new section (e.g. Projects)
            saveItem()
            section = line.replace(/=/g, '').trim()
        } else if (line.includes("---")) {
            // new item
            saveItem()
        } else if (line.startsWith("  ")) {
            const colon = line.indexOf(':')
            if (colon > 0) {
                const key = line.substr(3, colon - 3)
                const val = line.substr(colon + 2)
                item[key] = val
            }
        }
    }

    saveItem()
    return sections
}