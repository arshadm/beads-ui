<h1 align="center">
  Beads UI
</h1>
<p align="center">
  <b>Local UI for the <code>bd</code> CLI – <a href="https://github.com/steveyegge/beads">Beads</a></b><br>
  Collaborate on issues with your coding agent.
</p>
<div align="center">
  <a href="https://www.npmjs.com/package/beads-ui"><img src="https://img.shields.io/npm/v/beads-ui.svg" alt="npm Version"></a>
  <a href="https://semver.org"><img src="https://img.shields.io/:semver-%E2%9C%93-blue.svg" alt="SemVer"></a>
  <a href="https://github.com/mantoni/beads-ui/actions/worflows/ci.yml"><img src="https://github.com/mantoni/eslint_d.js/actions/workflows/ci.yml/badge.svg" alt="Build Status"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/npm/l/eslint_d.svg" alt="MIT License"></a>
  <br>
  <br>
</div>

## Features

- ✨ **Zero setup** – just run `bdui start`
- 📺 **Live updates** – Monitors the beads database for changes
- 🔎 **Issues view** – Filter and search issues, edit inline
- 🏷️ **Label workflow** – Drive custom task workflow states through labels
- ⛰️ **Epics view** – Show progress per epic, expand rows, edit inline
- 🏂 **Board view** – Blocked / Ready / In progress / Closed columns
- ⌨️ **Keyboard navigation** – Navigate and edit without touching the mouse
- 🔀 **Multi-workspace** – Switch between projects via dropdown, auto-registers
  workspaces

## Setup

```sh
npm i beads-ui -g
# In your project directory:
bdui start --open
```

See `bdui --help` for options.

## Screenshots

**Issues**

![Issues view](https://github.com/mantoni/beads-ui/raw/main/media/bdui-issues.png)

**Epics**

![Epics view](https://github.com/mantoni/beads-ui/raw/main/media/bdui-epics.png)

**Board**

![Board view](https://github.com/mantoni/beads-ui/raw/main/media/bdui-board.png)

## Label-driven workflow

This repository now supports a label-based workflow model for teams that need
more granular lifecycle states than native Beads status values.

### Workflow labels

- `created`
- `needs-planning`
- `planned`
- `ready-for-dev`
- `in-progress`
- `pr-created`
- `merged`
- `blocked`
- `closed`

### Workflow behavior

- New issues created from the UI are auto-labeled `created`.
- Exactly one workflow label is maintained at a time (non-workflow labels are
  preserved).
- In issue details, transition buttons are shown based on the current workflow
  label.
- If an issue has no workflow label, the UI shows `Workflow: Unassigned` and
  only allows transition to `Created`.
- Busy cursor feedback is shown while workflow transitions are being applied.

### Transition rules

- `created` -> `needs-planning`, `blocked`, `closed`
- `needs-planning` -> `planned`, `blocked`, `closed`
- `planned` -> `ready-for-dev`, `needs-planning`, `blocked`, `closed`
- `ready-for-dev` -> `in-progress`, `needs-planning`, `planned`, `blocked`,
  `closed`
- `in-progress` -> `pr-created`, `blocked`, `closed`
- `pr-created` -> `blocked`, `closed`
- `blocked` -> any other workflow state
- `closed` -> any other workflow state
- `merged` -> no outgoing transitions

### Issues filter updates

- Issues list now includes a **Labels** multi-select dropdown.
- Selecting multiple labels uses OR semantics.
- Selecting no labels disables label filtering (show all issues).
- Filter dropdown layering and opacity are tuned so menus render above the list
  content.

### Quick demo

Create one issue per workflow state for fast UI testing:

```sh
bd create "WF demo - created" --type task --priority 2
bd create "WF demo - needs-planning" --type task --priority 2
bd create "WF demo - planned" --type task --priority 2
bd create "WF demo - ready-for-dev" --type task --priority 2
bd create "WF demo - in-progress" --type task --priority 2
bd create "WF demo - pr-created" --type task --priority 2
bd create "WF demo - merged" --type task --priority 2
bd create "WF demo - blocked" --type task --priority 2
bd create "WF demo - closed" --type task --priority 2
```

Apply workflow labels (replace IDs with your created issue IDs):

```sh
bd label add <id-created> created
bd label add <id-needs-planning> needs-planning
bd label add <id-planned> planned
bd label add <id-ready-for-dev> ready-for-dev
bd label add <id-in-progress> in-progress
bd label add <id-pr-created> pr-created
bd label add <id-merged> merged
bd label add <id-blocked> blocked
bd label add <id-closed> closed
```

## Environment variables

- `BD_BIN`: path to the `bd` binary.
- `BDUI_RUNTIME_DIR`: override runtime directory for PID/logs. Defaults to
  `$XDG_RUNTIME_DIR/beads-ui` or the system temp dir.
- `HOST`: overrides the bind address (default `127.0.0.1`).
- `PORT`: overrides the listen port (default `3000`).
- `RABBITMQ_URL`: optional RabbitMQ connection URL (for transition events).
- `RABBITMQ_QUEUE`: queue prefix used for transition event publishing.

These can also be set via CLI options: `bdui start --host 0.0.0.0 --port 8080`

RabbitMQ transition events are optional. When both `RABBITMQ_URL` and
`RABBITMQ_QUEUE` are set, only transitions to `needs-planning` and
`ready-for-dev` publish messages with `taskId`, `taskTitle`, `taskLabels`,
`taskProjectId` (nullable), `previousLabel`, `newLabel`, and `taskStatus`.

The queue prefix is expanded to concrete queue names:

- `{prefix}-plan` when transitioning to `needs-planning`
- `{prefix}-execute` when transitioning to `ready-for-dev`

If publishing fails while configured, the transition action is rejected and
returned as an error to the UI.

## Platform notes

- macOS/Linux are fully supported. On Windows, the CLI uses `cmd /c start` to
  open URLs and relies on Node’s `process.kill` semantics for stopping the
  daemon.

## Developer Workflow

- 🔨 Clone the repo and run `npm install`.
- 🚀 Start the dev server with `npm start`.
- 🔗 Alternatively, use `npm link` to link the package globally and run
  `bdui start` from any project.

## Debug Logging

- The codebase uses the `debug` package with namespaces like `beads-ui:*`.
- Enable logs in the browser by running in DevTools:
  - `localStorage.debug = 'beads-ui:*'` then reload the page
- Enable logs for Node/CLI (server, build scripts) by setting `DEBUG`:
  - `DEBUG=beads-ui:* bdui start`
  - `DEBUG=beads-ui:* node scripts/build-frontend.js`

## License

MIT
