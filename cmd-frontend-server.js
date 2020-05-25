const fs = require('fs')
const url = require('url')
const http = require('http')
const path = require('path')
const util = require('util')
const child_process = require('child_process')

const defaultPort = 9876
const port = +process.env["PORT"] || defaultPort

/**
 * @param {string} [error]
 */
function printUsage(error) {
    if (error) {
        console.log("cmd-frontend-server: ", error)
    }
    console.log("Usage: node cmd-frontend-server.js [script directories] ...")
    process.exit(error ? 1 : 0)
}

if (process.argv.includes("-h") || process.argv.includes("--help")) {
    printUsage()
}

const scriptPaths = {} // map: script-name --> path to .js file
const commandPaths = {} // map: script-dir + command-name --> path to .cmd file

let perfMode = false // use 'production' react/babel js files (experimental)

const scriptDirectories = process.argv.slice(2) // skip ["node", "cmd-frontend-server.js"]

for (const dir of scriptDirectories) {
    if (dir == '--perf-mode') {
        perfMode = true
        continue
    }
    if (!fs.existsSync(dir)) {
        printUsage(`directory doesn't exist: ${dir}`)
    }
    const stats = fs.statSync(dir)
    if (stats.isDirectory()) {
        // collect all .js files as scripts
        fsWalk(dir, (dir, filepath) => {
            if (filepath.endsWith(".js")) {
                const dirname = path.basename(dir)
                const filename = path.basename(filepath, ".js")
                
                const scriptName =
                    dirname == filename
                    ? filename
                    : dirname + "-" + filename

                scriptPaths[scriptName] = filepath
                console.log(`using script ${scriptName} --> ${filepath}`)
            }
            if (filepath.endsWith(".cmd")) {
                // console.log("using command", filepath)
                commandPaths[dir + ": " + path.basename(filepath, ".cmd")] = filepath
            }
        })
    }
}

if (Object.keys(scriptPaths).length == 0) {
    printUsage("no .js scripts found")
}


http.createServer(async function server(req, res) {

    res.setHeader("Content-Security-Policy",
        `default-src 'self';` +
        `script-src 'unsafe-inline' 'unsafe-eval' 'self';` + // for babel-standalone
        `font-src 'self' data: https://fonts.gstatic.com;` +
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
    );
    res.setHeader("X-XSS-Protection", "1; mode=block")
    res.setHeader("X-Frame-Options", "SAMEORIGIN")

    try {
        console.log("req", req.url)
        const reqUrl = url.parse(req.url)
        const reqUrlSegments = reqUrl.pathname.split('/')

        if (reqUrlSegments[0] !== '') {
            throw new Error('requested url should start with /')
        }
        if (req.url === "/favicon.png") {
            return sendStaticFileForFrontend(["", "", "favicon.png"], "image/png", res)
        }
        switch (reqUrlSegments[1]) {
            case "":
            case "script":
                const indexfile = perfMode ? "index-perf-mode.html" : "index.html"
                return sendStaticFileForFrontend(["", "html", indexfile], "text/html", res)
            case "css":
                return sendStaticFileForFrontend(reqUrlSegments, "text/css", res)
            case "js":
                return sendStaticFileForFrontend(reqUrlSegments, "application/javascript", res)

            case "utils":
                const filename = reqUrlSegments[2]
                if (!ensureSimpleString("util", filename, res)) {
                    return
                }
                const fsPathToUtils = path.join("utils", filename + '.js')
                return await sendStaticFile(fsPathToUtils, "application/javascript", res)

            case "run":
                const url2 = new url.URL(req.url, "http://localhost")
                return await runCommand(url2.searchParams, res)

            case "loader-for-script":
                const scriptName = reqUrlSegments[2].replace(/%20/g, ' ')
                if (!ensureSimpleString("script", scriptName, res)) {
                    return
                }
                const scriptPath = scriptPaths[scriptName]
                if (!scriptPath) {
                    res.writeHead(404).write("404 - script not found")
                    res.end()
                    return
                }
                return sendStaticFile(scriptPath, "application/javascript", res)

            case "scripts":
                return sendScriptsList(res)

            default:
                res.writeHead(404).write("404 - bad route")
                res.end()
                return

        }

    } catch (e) {
        res.writeHead(500)
        res.write(util.inspect(e))
        res.end()
        console.error(e)
    }
}).listen(port, "localhost")
console.log("cli-frontend http server listening on http://localhost:" + port)

/**
 * @param {url.URLSearchParams} searchParams
 * @param {http.ServerResponse} res
 */
async function runCommand(searchParams, res) {

    const scriptName = searchParams.get("script")
    const cmdName = searchParams.get("cmd")
    const args = searchParams.getAll("arg")

    if (!ensureSimpleString("script", scriptName, res) || !ensureSimpleString("cmd", cmdName, res)) {
        return
    }
    if (args.find(arg => !ensureSimpleString("arg", arg, res))) {
        return
    }

    const scriptPath = scriptPaths[scriptName]
    const scriptDir = path.dirname(scriptPath)
    const cmdPath = commandPaths[scriptDir + ": " + cmdName]
    if (!cmdPath) {
        throw new Error('command not found')
    }

    const stat = await fs.promises.stat(cmdPath)
    if (!stat.isFile()) {
        throw new Error('command not found or not a file')
    }

    /**
     * @param stdout {string}
     * @param stderr {string}
     * @param err {child_process.ExecException}
     * */
    function execCallback(err, stdout, stderr) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        // console.log("execCallback", { err, stderr, stdout })
        if (err || stderr) {
            res.writeHead(500)
            if (stderr) {
                res.write(stderr)
                res.write("\r\n")
            }
            if (stdout) {
                res.write(stdout)
                res.write("\r\n")
            }
            res.write("Failed to run: " + cmdPath + "\r\n")
            if (err) {
                res.write(`Exited with code ${err.code}, signal ${err.signal} ${err.killed ? ", was killed" : ""}: `)
                res.write(`${err.message}\r\n`)
            }
            res.write(`Please check that .cmd file is executable\r\n`)
            res.write("\r\n")
            res.end()
        } else {
            res.writeHead(200)
            res.write(stdout)
            res.end()
        }
    }

    console.log(`    ${cmdPath}: args:`, args)
    //console.log("    text:  ", fs.readFileSync(cmdPath, 'utf8').split('\n').map((line, i) => i == 0 ? line : "            " + line).join('\n'))
    const proc = child_process.execFile(cmdPath, args, { maxBuffer: 100 * 1024 * 1024 /* 100MB */ }, execCallback)
    proc.addListener("exit", code => console.log(`    ${cmdPath}: exit code: ${code}`))
    if (proc.stdin) {
        proc.stdin.end()
    }
}

/**
 * @param {http.ServerResponse} res
 */
async function sendScriptsList(res) {

    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.write(JSON.stringify({ scripts: Object.keys(scriptPaths) }))
    res.end()

}

/**
 * @param {string[]} reqUrlSegments
 * @param {string} contentType
 * @param {http.ServerResponse} res
 */
function sendStaticFileForFrontend(reqUrlSegments, contentType, res) {

    const rawPath = "frontend/" + reqUrlSegments.slice(2).join('/')

    //console.log(`  sendStaticFile: ${rawPath} (${contentType})`)
    const normalised = path.normalize(rawPath)
    if (normalised.includes("..")) {
        throw new Error('sendStaticFile: .. not allowed')
    }
    const baseDirectory = __dirname
    const forcedRelative = normalised.startsWith("/") ? normalised.substr(1) : normalised
    const fsPath = path.join(baseDirectory, forcedRelative)

    sendStaticFile(fsPath, contentType, res)
}

/**
 * @param {import("fs").PathLike} fsPath
 * @param {string} contentType
 * @param {import("http").ServerResponse} res
 */
function sendStaticFile(fsPath, contentType, res) {
    if (!fs.existsSync(fsPath)) {
        res.writeHead(404)
        res.write("404")
        res.end()
        return
    }
    if (!fs.statSync(fsPath).isFile()) {
        res.writeHead(400)
        res.write("400 - not a file")
        res.end()
        return
    }
    const fileStream = fs.createReadStream(fsPath)
    fileStream.pipe(res)
    fileStream.on('open', function () {
        res.setHeader('Content-Type', contentType)
        res.writeHead(200)
    })
    fileStream.on('error', function (e) {
        res.writeHead(500)
        res.end()
        console.error(`sendStaticFile: ${fsPath} (${contentType})`, e)
    })
}

/**
 * @param {string} name
 * @param {string} value
 * @param {import("http").ServerResponse} res
 */
function ensureSimpleString(name, value, res) {
    if (!value || !/^[A-Za-z0-9-_ \.]+$/.test(value)) {
        console.error("bad string for", name, ":", value)
        res.writeHead(400)
        res.write(`invalid input data for ${name} - missing or only [A-Za-z0-9-_ .] allowed`)
        res.end()
        return false
    }
    if (value.includes('..')) {
        console.error("bad string for", name, ":", value)
        res.writeHead(400)
        res.write(`invalid input data for ${name} - double-dot not allowed`)
        res.end()
        return false
    }
    return true
}

function fsWalk(dir, callback) {
    const contents = fs.readdirSync(dir)
    for (const filename of contents) {
        const filepath = path.join(dir, filename)
        const stat = fs.statSync(filepath)
        if (stat.isDirectory()) {
            fsWalk(filepath, callback)
        } else {
            callback(dir, filepath)
        }
    }
}

