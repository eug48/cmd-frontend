
/**
 * @param imageStr {string}
 */
export async function getImageGitDate(gitHash, runCommand) {

    if (gitHash && gitHash.match(/^[a-z0-9]{40}$/)) {
        // look up git hash
        try {
            const commitDetails = await runCommand("git-commit-details", gitHash)
            /* output like:

            commit fcaa3a760bf89417ade67ebf26703bc1aeb80bda
            Author: Eugene <eugene@patsoftware.com.au>
            Date:   Fri Jun 14 16:27:16 2019 +1000

                backend: updated node to 10.13.0
            */
            const [commitLine, authorLine, dateLine, ...messageLines] = commitDetails.split("\n").map(s => s.trim())
            const date = new Date(dateLine.substr(5).trim())

            return {
                text: date.toDateString(),
                tooltip: commitDetails,
                sortKey: date.getTime(),
            }

        } catch {
            // likely git object not found
        }

    }
    return null
}
