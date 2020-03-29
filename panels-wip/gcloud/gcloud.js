/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load({ runCommand, setData, debug, warn, error }) {
    // PROJECTS
    const projectsJSON = await runCommand("projects")
    const projects = JSON.parse(projectsJSON)
    const projectIDs = projects.map(p => p.projectId)

    // INSTANCES
    const instanceRows = (await Promise.all(projectIDs.flatMap(async projectId => {
        try {
            const instancesJSON = await runCommand("instances", projectId)
            const instances = JSON.parse(instancesJSON)
            const rows = instances.map(i => ({ cells: [i.name, projectId] }))
            return rows
        } catch (err) {
            warn("error listing instances for project " + projectId, err)
            return []
        }
    }))).flat()
    console.log("instanceRows", instanceRows)

    const instancesData = {
        fields: [
            "Name",
            "Project"
        ],
        rows: instanceRows.filter(x => x),
    }

    const projectsData = {
        fields: [
            "Project",
        ],
        rows: projectIDs.map(projectId => ({ cells: [projectId] })),
        rawData: [
            {
                name: "projects",
                value: projectsJSON,
            }
        ],
    }
    setData([instancesData, projectsData])
}
