/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load({ runCommand, setData, warn }) {

    async function nullOnFailure(func) {
        try {
            return await func(runCommand)
        } catch (err) {
            warn(`error loading ${func.name}`, err)
            return null
        }
    }

    // const boincData = await boincLoadState(runCommand)
    // const foldingData = await foldingLoadState(runCommand)
    const [boincState, foldingState] = await Promise.all([
        nullOnFailure(boincLoadState),
        nullOnFailure(foldingLoadState),
    ])

    setData([
        {
            title: "Projects",
            fields: ["System", "Name", "Status", "User", "Team", "Credit"],
            rows: combineRows([[boincGetProjects, boincState], [foldingGetSlots, foldingState]]),
        },
        {
            title: "Tasks",
            fields: ["System", "Name", "Preferred deadline", "Files", "Scheduler", "Status", "Completion"],
            rows: combineRows([ [boincGetTasks, boincState], [foldingGetTasks, foldingState]  ]),
        }
    ])
}

function combineRows(funcs) {
    // return funcs.flatMap((f, i) => data[i] ? f(data[i]) : [])
    return funcs.flatMap(([f, data]) => data ? f(data) : [])
}

function boincGetTasks(sections) {

    const tasks = sections["Tasks"] || []

    const rows = tasks.map(task => {
        const deadline = task["report deadline"]
        const state = task["state"]
        const schedulerState = task["scheduler state"]
        const taskState = task["active_task_state"]
        const completion = (parseFloat(task["fraction done"]) * 100).toFixed(2) + '%'
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

function boincGetProjects(sections) {

    const projects = sections["Projects"] || []

    const rows = projects.map(project => {
        const name = project["name"]
        const url = project["master URL"]
        const user_name = project["user_name"]
        const team_name = project["team_name"]
        const suspended = project["suspended via GUI"]
        const noMoreWork = project["don't request more work"]
        const credit = project["user_total_credit"]

        const suspendedText = suspended == "yes" ? ["suspended"] : []
        const noMoreWorkText = noMoreWork == "yes" ? ["don't request more work"] : []
        const status = suspendedText.concat(noMoreWorkText).join(', ')

        return {
            cells: ["BOINC", name, status, user_name, team_name, credit],
            key: name,
            async getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {
                async function run(command) {
                    // hack to encode non-alpha characters to get past ensureSimpleString
                    const encodedUrl =
                        url
                            .replace(/:/g, '1')
                            .replace(/\//g, '2')
                            .replace(/\./g, '3')

                    await runCommand("boinc-project-cmd", encodedUrl, command)
                    window["location"].reload()
                }
                setData({
                    buttons: [
                        {
                            text: "Suspend",
                            onClicked: () => run("suspend")
                        },
                        {
                            text: "Resume",
                            onClicked: () => run("resume")
                        },
                        {
                            text: "No more work",
                            onClicked: () => run("nomorework")
                        },
                        {
                            text: "Allow more work",
                            onClicked: () => run("allowmorework")
                        },
                        {
                            text: "Show messages",
                            async onClicked() {
                                const messages = await runCommand("boinc-messages")
                                showModal({ text: messages })
                            }
                        },

                    ],
                    json: project,
                })
            }
        }
    })

    return rows
}

async function boincLoadState(runCommand) {
    const text = await runCommand("boinc")
    const sections = boincParse(text)
    console.log(text, sections)
    return sections
}

/**
 * @param {string} text
 */
function boincParse(text) {
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
                if (!(key in item)) { // "GUI URL" sections shouldn't overwrite previous items
                    item[key] = val
                }
            }
        }
    }

    saveItem()
    return sections
}

async function foldingLoadState(runCommand) {
    const text = await runCommand("folding-at-home")

    let sections = {}

    const re = /^((PyON \d+ (\w+))|---)/gm
    let section = ""
    let jsonStart = 0
    var match
    while ((match = re.exec(text)) != null) {
        console.log("FAH PyON: regex match found at ", match)
        if (match[0] === "---") {
            const json = text.substring(jsonStart, match.index).replace(/True/g, "true").replace(/False/g, "false")
            console.log("  JSON ", json)
            sections[section] = JSON.parse(json)
        } else {
            section = match[3]
            jsonStart = match.index + match[0].length
        }
    }
    console.log(text, sections)
    return sections
}

function foldingGetSlots(sections) {

    const slots = sections["slots"] || []
    const { user, team } = sections["options"] || {}

    const rows = slots.map(slot => {
        const { id, status, description, idle, reason } = slot

        const statusText = reason == "" ? status : `${status} - ${reason}`

        const credits = {
            text: "stats",
            url: 'https://stats.foldingathome.org/donor/' + user
        }

        return {
            cells: ["F@H", `slot ${id} ${description}`, statusText.toLowerCase(), user, team, credits],
            key: id,
            getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {
                async function run(command) {
                    await runCommand("folding-at-home-" + command, id)
                    window["location"].reload()
                }
                setData({
                    buttons: [
                        {
                            text: "Don't request more work",
                            onClicked: () => run('finish')
                        },
                        {
                            text: "Set idle mode",
                            onClicked: () => run('idle')
                        },
                        {
                            text: "Set always on mode",
                            onClicked: () => run('always-on')
                        },
                    ],
                    json: slot
                })
            }
        }
    })

    return rows
}

function foldingGetTasks(sections) {

    const units = sections["units"] || []

    const rows = units.map(unit => {
        const { project, core, slot,
            percentdone, eta,
            state, error,
            timeout, deadline, timeremaining
        } = unit

        const nameCell = {
            text: `Project ${project} (core ${core})`,
            url: `https://stats.foldingathome.org/project?p=${project}`
        }

        const deadlineCell = {
            text: new Date(timeout).toLocaleString(),
            tooltip: `Deadline till WU re-sent: ${timeout}\r\nDeadline for credit: ${timeremaining} ${deadline}`
        }

        const stateCell =
            error == "NO_ERROR"
                ? state
                : `${state}, ${error}`

        const doneCell = {
            text: percentdone,
            tooltip: `ETA: ${eta}`,
        }

        return {
            cells: ["F@H", nameCell, deadlineCell, "", "", stateCell, doneCell],
            key: unit.name,
            getExpandedDetail({ runCommand, showModal, setClipboard, setData }) {
                setData({
                    json: unit
                })
            }
        }
    })

    return rows
}