/// <reference path="../../frontend/types.d.ts" />

const allKeys = new Set()

/**
 * @param args {LoadFunctionArgs}
 */
export async function load({ runCommand, setData, settings, debug, warn, error }) {

    const defaultFields = new Set(["Name", "VmHWM", "VmRSS", "Pid"])

    const fieldsSet = new Set(defaultFields)

    for (const [k, v] of Object.entries(settings)) {
        if (k == "Show kernel threads") {
            continue
        }

        const spacePos = k.indexOf(' ')
        const field = k.substr(0, spacePos) // remove docs
        if (v) {
            fieldsSet.add(field)
        } else {
            fieldsSet.delete(field)
        }
    }

    const showKernelThreads = !!settings["Show kernel threads"]

    const statusData = await runCommand("proc-statuses")
    const rows = Array.from(parseStatusFiles(statusData, fieldsSet, showKernelThreads))

    const defaultSettings = {
        "Show kernel threads": false,
    }
    Array.from(allKeys).forEach(k => {
        defaultSettings[k + ' - ' + docs[k]] = defaultFields.has(k);
    })

    setData({
        rows,
        fields: Array.from(fieldsSet).map(f => ({ text: f, tooltip: docs[f] })),
        defaultSettings,
    })
}

// based on http://man7.org/linux/man-pages/man5/proc.5.html (GPLv2 or later)
const docs = {
    "Name": "Command run",

    "Umask": "Process umask in octal",

    'State': 'Current state,  One of R (running), S (sleeping), D (disk sleep), T (stopped), T (tracing stop), Z (zombie), or X (dead).',

    'Tgid': 'Thread group ID (i.e. Process ID)',
    'Ngid': 'NUMA group ID (0 if none)',
    'Pid': 'Thread ID (see man gettid)',
    'PPid': 'PID of parent process.',
    'TracerPid': 'PID of process tracing this process (0 if not being traced)',

    'Uid': 'Real, effective, saved set and filesystem UIDs',
    'Gid': 'Real, effective, saved set and filesystem GIDs',

    'FDSize': 'Number of file descriptor slots currently allocated.',

    'Groups': 'Supplementary group list.',

    'NStgid': 'Thread group ID (i.e., PID) in each of the PID namespaces of which [pid] is a member.  The leftmost entry shows the value with respect to the PID namespace of the process that mounted this procfs (or the root namespace if mounted by the kernel), followed by the value in succes‐ sively nested inner namespaces.',
    'NSpid': 'Thread ID in each of the PID namespaces of which [pid] is a member.  The fields are ordered as for NStgid.',
    'NSpgid': 'Process group ID in each of the PID namespaces of which [pid] is a member.  The fields are ordered as for NSt‐ gid. ',
    'NSsid': 'Descendant namespace session ID hierarchy Session ID in each of the PID namespaces of which [pid] is a member. The fields are ordered as for NStgid. ',

    'VmPeak': 'Peak virtual memory size.',
    'VmSize': 'Virtual memory size.',
    'VmLck': 'Locked memory size (see mlock(2)).',
    'VmPin': "Pinned memory size.  These are pages that can't be moved because something needs to directly access physical memory.",
    'VmHWM': 'Peak resident set size ("high water mark")',
    'VmRSS': 'Resident set size - sum of RssAnon, RssFile, and RssShmem.',

    'RssAnon': 'Size of resident anonymous memory',
    'RssFile': 'Size of resident file mappings',
    'RssShmem': 'Size of resident shared memory (includes System V shared memory, mappings from tmpfs(5), and shared anonymous mappings).',

    'VmData': 'Size of data segment',
    'VmStk': 'Size of stack segment',
    'VmExe': 'Size of text segment',
    'VmLib': 'Shared library code size',
    'VmPTE': 'Page table entries size',
    'VmPMD': 'Size of second-level page tables',
    'VmSwap': 'Swapped-out virtual memory size by anonymous private pages; shmem swap usage is not included',

    'HugetlbPages': 'Size of hugetlb memory portions ',

    'CoreDumping': 'Contains the value 1 if the process is cur rently dumping core, and 0 if it is not',

    'Threads': 'Number of threads in process containing this thread.',

    'SigQ': 'two slash-separated numbers, the first is the number of currently queued signals for this real user ID, the second is the resource limit on the number of queued signals for this process (see the description of RLIMIT_SIGPENDING in man 2 getrlimit)',

    'SigPnd': 'Mask (expressed in hexadecimal) of signals pending for thread (see man 7 pthreads and man 7 signal)',
    'ShdPnd': 'Mask (expressed in hexadecimal) of signals pending for process as a whole (see man 7 pthreads and man 7 signal)',

    'SigBlk': 'Mask (in hexadecimal) indicating signals being blocked (see man signal).',
    'SigIgn': 'Mask (in hexadecimal) indicating signals being ignored (see man signal).',
    'SigCgt': 'Mask (in hexadecimal) indicating signals being caught (see man signal).',

    'CapInh': 'Mask (in hexadecimal) of capabilities enabled in inheritable sets (see man capabilities)',
    'CapPrm': 'Mask (in hexadecimal) of capabilities enabled in permitted sets (see man capabilities)',
    'CapEff': 'Mask (in hexadecimal) of capabilities enabled in effective sets (see man capabilities)',

    'CapBnd': 'Capability bounding set, expressed in hexadecimal (see man capabilities)',
    'CapAmb': 'Ambient capability set, expressed in hexadecimal (see man capabilities)',

    'NoNewPrivs': 'Value of the no_new_privs bit (see man prctl)',

    'Seccomp': 'Seccomp mode of the process (see man seccomp). 0 means SECCOMP_MODE_DISABLED; 1 means SEC‐COMP_MODE_STRICT; 2 means SECCOMP_MODE_FILTER.  This field is provided only if the kernel was built with the CON‐FIG_SECCOMP kernel configuration option enabled.',

    'Speculation_Store_Bypass': 'Speculation flaw mitigation state (see man prctl)',

    'Cpus_allowed': 'Hexadecimal mask of CPUs on which this process may run (see man cpuset)',
    'Cpus_allowed_list': 'Same as previous, but in "list format" (see man cpuset)',

    'Mems_allowed': 'Mask of memory nodes allowed to this process (see man cpuset)',
    'Mems_allowed_list': 'Same as previous, but in "list format" (see man cpuset)',

    'voluntary_ctxt_switches': 'Number of voluntary context switches',
    'nonvoluntary_ctxt_switches': 'Number of involuntary context switches',
}

/**
 * @param {string} statusData
 * @param {Set<string>} fields
 * @param {boolean} showKernelThreads
 */
function* parseStatusFiles(statusData, fields, showKernelThreads) {

    const fieldCount = fields.size
    const fieldsMap = new Map()
    fields.forEach(f => fieldsMap.set(f, fieldsMap.size))

    let cells = Array(fieldCount).fill("")
    let ignore = !showKernelThreads
    let pid = ""
    let first = true

    function getExpandedDetail(pid) {
        /**
         * @param args {LoadFunctionArgs}
         */
        async function getExpandedDetail({ runCommand, setData }) {
            try {

                const status = await runCommand("proc-status", pid)
                const cmdline = await runCommand("proc-cmdline", pid)
                const environ = await runCommand("proc-environ", pid)
                const environSorted = environ.split("\n").sort().join("\n")
                setData([
                    { title: "Commandline", text: cmdline, },
                    { title: "Environment", text: environSorted, },
                    { title: "Status", text: status, }
                ])
            } catch (err) {
                setData({
                    text: err.toString()
                })
            }
        }
        return getExpandedDetail
    }

    for (const line of statusData.split("\n")) {

        const colonPos = line.indexOf(":")
        const fieldName = line.substr(0, colonPos)
        allKeys.add(fieldName)

        if (fieldName === "Name" && !first) {
            // on to next process
            if (!ignore) {
                yield { cells, key: pid, getExpandedDetail: getExpandedDetail(pid) }
            }
            cells = Array(fieldCount).fill("")
            ignore = !showKernelThreads
        }

        if (fieldName === "Pid") {
            pid = line.substr(colonPos + 2).trim()
        }

        if (fieldName == "VmPeak") {
            ignore = false
        }

        const index = fieldsMap.get(fieldName)
        if (index != null) {

            const fieldValue = line.substr(colonPos + 2).trim()
            first = false

            if (fieldValue.endsWith(" kB")) {
                // convert to MB
                const asMB = (parseInt(fieldValue, 10) / 1024).toFixed(1) + " MB"
                cells[index] = asMB
            } else {
                cells[index] = fieldValue
            }
        }
    }

    if (cells.length > 0) {
        yield { cells, key: pid, getExpandedDetail: getExpandedDetail(pid) }
    }
}

/*
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/