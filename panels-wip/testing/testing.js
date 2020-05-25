/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load({ runCommand, setData, debug, warn, error }) {
    const lines = await runCommand("random_lines")

    const data1 = {
        fields: [
            "Line",
            "UUID",
        ],
        rows: lines.split("\n").map((uuid, i) => ({
            cells: [i, uuid],
            key: i + '',
            // getExpandedDetail: async ({ runCommand, setData }) => {
            //     const lines = await runCommand("random_lines")
            // },
            getExpandedDetail: load,
        })),
        rawData: [
            {
                name: "lines",
                value: lines,
            }
        ],
    }
    setData([data1])
}
