# AGENTS.md

Instructions for agents working in this repository.

## About the Project

This is a small static page for comparing MediaTek MT7981 routers with an OpenWRT focus.

- `index.html` contains the page markup.
- `style.css` contains all styles, including the light and dark themes.
- `script.js` loads the CSV files, parses the data, and builds the table, footnotes, and interactivity.
- `data.csv` is the source for table rows.
- `notes.csv` is the source for footnote notes.
- `README.md` describes the data format for contributors.

The project does not use a bundler, package manager, or server-side code.

## Deployment

The project is deployed as GitHub Pages and must remain fully static.

- Do not add server-side dependencies or runtime requirements.
- All local resource paths must work when the repository is published on GitHub Pages.
- Before changing routing, file names, or directory structure, account for the fact that the published version is served as a static site.

## Running Locally

Because the page uses `fetch("data.csv")` and `fetch("notes.csv")`, it must be tested through an HTTP server instead of opening the file directly in a browser.

Recommended command:

```bash
python3 -m http.server 8000
```

After starting the server, open:

```text
http://localhost:8000/
```

If the port is already in use, use another port:

```bash
python3 -m http.server 8080
```

## Verifying Changes

The project has no automated tests. After making changes, verify manually that:

- the table loads without browser console errors;
- the first row and first column remain sticky;
- theme switching works and persists in `localStorage`;
- footnotes in `[1]` format are converted to `sup` and scroll to the corresponding note;
- values with `|good` and `|warn` suffixes are highlighted;
- horizontal table scrolling works on narrow screens.

For CSV edits, also verify that:

- `data.csv` keeps the existing column order;
- every router row has the same number of columns as the header;
- fields containing commas are wrapped in double quotes;
- double quotes inside a field are escaped as `""`;
- footnote IDs used in `data.csv` exist in `notes.csv`;
- new notes in `notes.csv` use the `id,text` format.

## Data Rules

- One row in `data.csv` corresponds to one router.
- The first column in `data.csv` is the device model.
- Do not change the column order without also updating README and verifying the rendered output.
- For value highlighting, use only the existing classes:
  - `|good` - advantage;
  - `|warn` - important nuance or limitation.
- Write footnotes as numbers in square brackets: `[1]`, `[2]`, `[3]`.
- Do not add line breaks inside CSV fields unless there is an explicit need and the parser has been manually verified.
- When adding or clarifying specifications, prefer neutral wording and do not make unsupported conclusions about OpenWRT support.

## Code Change Rules

- Keep the project dependency-free unless the task explicitly requires otherwise.
- Do not add a bundler, framework, or TypeScript for small changes.
- Prefer simple changes in the existing `index.html`, `style.css`, and `script.js` files.
- Do not change the public format of `data.csv` or `notes.csv` without updating README.
- When changing project structure, run commands, deployment, CSV format, highlight CSS classes, or other working rules, update this `AGENTS.md`.
- If this `AGENTS.md` needs additions or corrections, write them in English.
- Account for the fact that `renderFootnotes()` currently keeps compatibility with `**` by replacing it with `[3]`.
- When adding new highlight classes, update CSS, README, and this file.
- When inserting data into the DOM, avoid unsafe HTML where it is not required. Currently, HTML is only needed for footnotes inside cells.

## Style

- The main language of the project and user-facing documentation is Russian.
- Keep this `AGENTS.md` in English, including future additions when they are needed.
- Use clear technical wording without a marketing tone.
- In CSS, follow the existing structure with section comments.
- In JS, follow the current simple vanilla JavaScript approach.
- Preserve table responsiveness and readability on mobile screens.
