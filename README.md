# cmd-frontend

Web-based front-ends for arbitrary commands.

* Designed to be highly secure
  * Server code in one easy to audit .js file
  * Only commands whitelisted on the server can run
  * No server-side dependencies except node. No `npm install`
* Designed for quick and easy development
  * No compilation steps - TypeScript is loaded using [@babel/standalone](https://babeljs.io/docs/en/babel-standalone) - just refresh the page to run updated code
  * Scripts use an API ([frontend/types.d.ts](frontend/types.d.ts)) that decouples them from rendering the UI or executing commands

Each "script directory" contains sub-directories with js files and cmd files. Each js file represents a page that becomes available from the front-end. When the page is opened the corresponding script's `load` function is run - it can ask the server to run cmd files in its subdirectory, load the results and display a web-based GUI.

# Usage

```bash
node cmd-frontend-server.js [script directories]

e.g.
node cmd-frontend-server.js panels/

open http://localhost:9876
```



# Included scripts / panels

Basic functionality should be working:

* Linux process info
* Kubernetes (controllers, pods)

Work in progress:

* gcloud (e.g. listing Compute Engine VMs)
* Qubes GUI

# Development setup

```bash
nodemon cmd-frontend-server.js panels/ panels-wip/
```

```bash
yarn install # for TypeScript @types/node
cd frontend
yarn install
```

# Roadmap / Wishlist

* Running commands on multiple machines through PubSub, HTTP and/or SSH
* Charts (e.g. for CPU usage, temperature)
* Charts with persistent data


# Thanks to these projects

* Node.js
* React
* [Semantic UI React](https://react.semantic-ui.com/)
* TypeScript
* Babel
* [Pika](https://www.pika.dev)
* [React JSON Inspector](https://github.com/Lapple/react-json-inspector)
* [timeago.js](https://github.com/hustcc/timeago.js)
* Visual Studio Code