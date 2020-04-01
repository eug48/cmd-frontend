/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load({ runCommand, setData }) {

    const json = await runCommand("ListUnits")
    const data = JSON.parse(json).data[0]

    const rows = data.map(([name, description, loadState, activeState, subState, following, path, jobId, jobType, jobPath]) => (
        {
            cells: [name, loadState, activeState, subState, description],
            key: name,
        }
    ))

    setData({
        fields: ["Name", "Load", "Active", "Sub-state", "Description"],
        rows,
    })
}
