// @ts-nocheck

import { Dropdown, Tab, Button } from '/js/web_modules/semantic-ui-react.js';
import Highlight, { defaultProps } from "/js/web_modules/prism-react-renderer.js";
import ReactJsonInspector from '/js/web_modules/react-json-inspector.js';

import dracula from "/js/node_modules/prism-react-renderer/themes/dracula/index.js";
import duotoneDark from "/js/node_modules/prism-react-renderer/themes/duotoneDark/index.js";
import duotoneLight from "/js/node_modules/prism-react-renderer/themes/duotoneLight/index.js";
import github from "/js/node_modules/prism-react-renderer/themes/github/index.js";
import nightOwl from "/js/node_modules/prism-react-renderer/themes/nightOwl/index.js";
import nightOwlLight from "/js/node_modules/prism-react-renderer/themes/nightOwlLight/index.js";
import oceanicNext from "/js/node_modules/prism-react-renderer/themes/oceanicNext/index.js";
// palenight is broken - awaiting PR to be merged (TODO)
// import palenight from "/js/node_modules/prism-react-renderer/themes/palenight/index.js";
import shadesOfPurple from "/js/node_modules/prism-react-renderer/themes/shadesOfPurple/index.js";
import ultramin from "/js/node_modules/prism-react-renderer/themes/ultramin/index.js";
import vsDark from "/js/node_modules/prism-react-renderer/themes/vsDark/index.js";

// using htm.js rather than JSX since babel-standalone doesn't seem to
// transform nested imports..
import htm from "/js/node_modules/htm/dist/htm.module.js";
const html = htm.bind(React.createElement);

export default function JsonViewer(props) {

    const panes = [
        {
            menuItem: 'JSON', render() {
                return html`<${JsonHighlighter} data=${props.data} />`
            }
        },
        {
            menuItem: 'Inspector', render() {
                return html`
                    <div style=${{ marginTop: "0.5em" }}>
                        <${ReactJsonInspector}
                            data=${(typeof (props.data) == "string" ? JSON.parse(props.data) : props.data)}
                            isExpanded=${() => true} />
                    </div>
                `;
            }
        },
        /*
        {
            menuItem: 'Simple', render() {
                const str = typeof (props.data) === "string" ? props.data : JSON.stringify(props.data, null, 2);
                return html`<pre>${str}</pre>`
            }
        },
        */
    ]

    const onSaveToConsole = React.useCallback((event, data) => {
        window.data = typeof (props.data) == "string" ? JSON.parse(props.data) : props.data
        console.log("data", window.data)
        alert("Data saved as window.data - use F12 Developer Console to explore")
    }, [])

    return html`
        <div style=${{ position: "relative" }}>
            <${Tab}
                style=${{ margin: "0.5em" }}
                panes=${panes}
            />
            <${Button} style=${{ position: "absolute", top: "0", right: "0.5em" }}
                icon="code"
                title="Save to F12 Developer Tools"
                onClick=${onSaveToConsole}
            />
        </div>
    `
}
window.JsonViewer = JsonViewer

function JsonHighlighter(props) {
    const str = typeof (props.data) === "string" ? props.data : JSON.stringify(props.data, null, 2);

    const themes = [
        "duotoneLight",
        "github",
        "nightOwlLight",
        "ultramin",

        "dracula",
        "duotoneDark",
        "nightOwl",
        "oceanicNext",
        // "palenight",
        "shadesOfPurple",
        "vsDark",
    ]
    const lastThemeKey = 'cmd-frontend-last-json-theme'
    const lastTheme = window.localStorage.getItem(lastThemeKey)
    const [theme, setTheme] = React.useState(lastTheme || "github")

    function getTheme(name) {
        switch (name) {
            case "duotoneLight": return duotoneLight
            case "github": return github
            case "nightOwlLight": return nightOwlLight
            case "ultramin": return ultramin

            case "oceanicNext": return oceanicNext
            case "dracula": return dracula
            case "duotoneDark": return duotoneDark
            case "nightOwl": return nightOwl
            case "oceanicNext": return oceanicNext
            // case "palenight": return palenight
            case "shadesOfPurple": return shadesOfPurple
            case "vsDark": return vsDark
        }
    }
    const themeOptions = themes.map(t => ({ key: t, text: t, value: t }))
    const onThemeChanged = React.useCallback((event, data) => {
        window.localStorage.setItem(lastThemeKey, data.value)
        setTheme(data.value)
    }, [])
    return (html`
        <${Highlight} ...${defaultProps} theme=${getTheme(theme)} code=${str} language="json">
            ${({ className, style, tokens, getLineProps, getTokenProps }) => html`
                <pre className=${className} style=${style}>
                    <${Dropdown} compact selection style=${{ float: "right" }}
                        title="Theme"
                        defaultValue=${theme}
                        options=${themeOptions}
                        onChange=${onThemeChanged}
                        closeOnChange=${false}
                    />
                    ${tokens.map((line, i) => (html`
                        <div ...${getLineProps({ line, key: i })}>
                            ${line.map((token, key) => (html`<span ...${getTokenProps({ token, key })}><//>`))}
                        </div>
                    `))}
                </pre>
            `}
        <//>
    `)
}
/*
                        <div {...${getLineProps({ line, key: i })}}>


*/