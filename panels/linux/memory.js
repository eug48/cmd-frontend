/// <reference path="../../frontend/types.d.ts" />

/**
 * @param args {LoadFunctionArgs}
 */
export async function load({ runCommand, setData, settings, debug, warn, error }) {

    const vmstat = await runCommand("vmstat")
    const meminfo = await runCommand("meminfo")

    const showDescriptions = !!settings["Show descriptions"]
    const descriptionField = showDescriptions ? ["Description"] : []
    const descriptionCell = showDescriptions ? meminfoDocs : (() => [])

    setData([
        {
            title: "/proc/meminfo",
            rows: meminfo.trimRight()
            .split("\n")
                    .map(line => line.split(":"))
                    .map(([key, v]) => ({
                        key,
                        cells: [ { text: key, tooltip: meminfoDocs(key)[0] }, convertKb(v), ...descriptionCell(key)]
                    })),
            fields: ["", "Value", ...descriptionField],
            defaultSettings: {
                "Show descriptions": false
            }
        },
        {
            title: "/proc/vmstat",
            rows: vmstat.trimRight()
                    .split("\n")
                    .map(line => line.split(" "))
                    .map(([key, v]) => ({ key, cells: [key, v] })),
            fields: ["", "Raw value"],
        },
    ])
}

/**
 * @param str {string}
 */
function convertKb(str) {
    if (!str) {
        return str
    }
    if (str.endsWith("kB")) {
        const kb = parseInt(str)
        if (kb > 1024) {
            return Math.round(kb / 1024).toLocaleString() + " MB"
        }
    }

    return str
}

// docs from
// https://www.kernel.org/doc/Documentation/filesystems/proc.txt
// https://www.kernel.org/doc/Documentation/vm/hugetlbpage.txt
// https://man7.org/linux/man-pages/man5/proc.5.html
const docs = `
    MemTotal: Total usable ram (i.e. physical ram minus a few reserved bits and the kernel binary code)
     MemFree: The sum of LowFree+HighFree
MemAvailable: An estimate of how much memory is available for starting new applications, without swapping. Calculated from MemFree, SReclaimable, the size of the file LRU lists, and the low watermarks in each zone. The estimate takes into account that the system needs some page cache to function well, and that not all reclaimable slab will be reclaimable, due to items being in use. The impact of those factors will vary from system to system.
     Buffers: Relatively temporary storage for raw disk blocks shouldn't get tremendously large (20MB or so)
      Cached: in-memory cache for files read from the disk (the pagecache).  Doesn't include SwapCached
  SwapCached: Memory that once was swapped out, is swapped back in but still also is in the swapfile (if memory is needed it doesn't need to be swapped out AGAIN because it is already in the swapfile. This saves I/O)
      Active: Memory that has been used more recently and usually not reclaimed unless absolutely necessary.
    Inactive: Memory which has been less recently used.  It is more eligible to be reclaimed for other purposes
    HighTotal: Highmem is all memory above ~860MB of physical memory Highmem areas are for use by userspace programs, or for the pagecache.  The kernel must use tricks to access this memory, making it slower to access than lowmem.
    LowTotal: Lowmem is memory which can be used for everything that highmem can be used for, but it is also available for the kernel's use for its own data structures.  Among many other things, it is where everything from the Slab is allocated.  Bad things happen when you're out of lowmem.
   SwapTotal: total amount of swap space available
    SwapFree: Memory which has been evicted from RAM, and is temporarily on the disk
       Dirty: Memory which is waiting to get written back to the disk
   Writeback: Memory which is actively being written back to the disk
   AnonPages: Non-file backed pages mapped into userspace page tables
HardwareCorrupted: The amount of RAM/memory in KB, the kernel identifies as corrupted.
AnonHugePages: Non-file backed huge pages mapped into userspace page tables
      Mapped: files which have been mmaped, such as libraries
       Shmem: Total memory used by shared memory (shmem) and tmpfs
ShmemHugePages: Memory used by shared memory (shmem) and tmpfs allocated with huge pages
ShmemPmdMapped: Shared memory mapped into userspace with huge pages
KReclaimable: Kernel allocations that the kernel will attempt to reclaim under memory pressure. Includes SReclaimable (below), and other direct allocations with a shrinker.
        Slab: in-kernel data structures cache
SReclaimable: Part of Slab, that might be reclaimed, such as caches
  SUnreclaim: Part of Slab, that cannot be reclaimed on memory pressure
  PageTables: amount of memory dedicated to the lowest level of page tables.
NFS_Unstable: NFS pages sent to the server, but not yet committed to stable storage
      Bounce: Memory used for block device "bounce buffers"
WritebackTmp: Memory used by FUSE for temporary writeback buffers
 CommitLimit: Based on the overcommit ratio ('vm.overcommit_ratio'), this is the total amount of  memory currently available to be allocated on the system. This limit is only adhered to if strict overcommit accounting is enabled (mode 2 in 'vm.overcommit_memory'). The CommitLimit is calculated with the following formula: CommitLimit = ([total RAM pages] - [total huge TLB pages]) * overcommit_ratio / 100 + [total swap pages] For example, on a system with 1G of physical RAM and 7G of swap with a vm.overcommit_ratio of 30 it would yield a CommitLimit of 7.3G. For more details, see the memory overcommit documentation in vm/overcommit-accounting.
Committed_AS: The amount of memory presently allocated on the system. The committed memory is a sum of all of the memory which has been allocated by processes, even if it has not been "used" by them as of yet. A process which malloc()'s 1G of memory, but only touches 300M of it will show up as using 1G. This 1G is memory which has been "committed" to by the VM and can be used at any time by the allocating application. With strict overcommit enabled on the system (mode 2 in 'vm.overcommit_memory'),allocations which would exceed the CommitLimit (detailed above) will not be permitted. This is useful if one needs to guarantee that processes will not fail due to lack of memory once that memory has been successfully allocated.
VmallocTotal: total size of vmalloc memory area
 VmallocUsed: amount of vmalloc area which is used
VmallocChunk: largest contiguous block of vmalloc area which is free
      Percpu: Memory allocated to the percpu allocator used to back percpu allocations. This stat excludes the cost of metadata.


HugePages_Total: is the size of the pool of huge pages.
HugePages_Free:  is the number of huge pages in the pool that are not yet allocated.
HugePages_Rsvd:  is short for "reserved," and is the number of huge pages for which a commitment to allocate from the pool has been made, but no allocation has yet been made.  Reserved huge pages guarantee that an application will be able to allocate a huge page from the pool of huge pages at fault time.
HugePages_Surp:  is short for "surplus," and is the number of huge pages in the pool above the value in /proc/sys/vm/nr_hugepages. The maximum number of surplus huge pages is controlled by /proc/sys/vm/nr_overcommit_hugepages.
Hugepagesize:    is the default hugepage size (in Kb).
Hugetlb:         is the total amount of memory (in kB), consumed by huge pages of all sizes. If huge pages of different sizes are in use, this number will exceed HugePages_Total * Hugepagesize. To get more detailed information, please, refer to /sys/kernel/mm/hugepages (described below).


DirectMap4k: Number of bytes of RAM linearly mapped by kernel in 4 kB pages.
DirectMap4M: Number of bytes of RAM linearly mapped by kernel in 4 MB pages.
DirectMap2M: Number of bytes of RAM linearly mapped by kernel in 2 MB pages.
`

const docsMap = new Map(docs.split("\n").map(line => line.split(":", 2).map(s => s.trim())))

function meminfoDocs(key) {
    return [docsMap.get(key) ?? ""]
}