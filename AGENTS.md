# AGENTS.md

Instructions for agents working in this repository.

## About the Project

This is a small static page for comparing routers with an OpenWRT focus.

- `index.html` contains the page markup.
- `style.css` contains all styles, including the light and dark themes.
- `script.js` loads the CSV files, parses the data, and builds the table, footnotes, and interactivity.
- `data.csv` is the source for table rows.
- `notes.csv` is the source for footnote notes.
- `favicon.svg` is the site icon.
- `og-preview.png` is the preview image for social media.
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
- theme synchronizes automatically with system preference if not manually overridden;
- footnotes in `[1]` format are converted to `sup` and scroll to the corresponding note;
- search works correctly, shows result counts, and the clear button (X) resets the state;
- column sorting works (Natural Sort), and the active column has the `.active-sort` class;
- URL parameters (`q`, `sort`, `dir`) correctly reflect and restore the page state;
- keyboard navigation works (Tab focus on headers, Enter/Space for sorting);
- values with `|good` and `|warn` suffixes are highlighted and retain distinctive tinted colors on row and column hover;
- quick filter chips filter rows and synchronize with URL parameter `f`;
- compare mode allows selecting routers via checkboxes, toggles "Только выбранные", and synchronizes with URL parameters `compare` and `only`;
- the share button copies the current filtered/sorted/compare URL to clipboard with visual feedback;
- status badges in Multi-Gig and Availability columns render with distinct styled badges;
- footnote tooltips appear on hover/focus over `sup`, and footnote items contain a backlink (`↑ к таблице`) that returns to the table;
- table fits within the desktop viewport without horizontal scroll on standard laptop and desktop screens (>=1200px), while horizontal table scrolling remains functional on narrower screens (<1200px).

For CSV edits, also verify that:

- `data.csv` keeps the existing column order;
- every router row has the same number of columns as the header;
- fields containing commas are wrapped in double quotes;
- double quotes inside a field are escaped as `""`;
- footnote IDs used in `data.csv` exist in `notes.csv`;
- new notes in `notes.csv` use the `id,text` format.

## Continuous Integration (CI)

The repository uses GitHub Actions (`.github/workflows/ci.yml`) to automatically validate the format of `data.csv` and `notes.csv` on pushes and pull requests. The validation is performed by `scripts/validate_csv.py`.

A companion workflow (`.github/workflows/pr-comment.yml`) uses the secure `workflow_run` event to automatically post and update status comments on pull requests (including PRs from external forks) without executing untrusted code. It searches for previous comments using a hidden HTML marker (`<!-- csv-validation-comment -->`) to update existing comments and prevent PR comment clutter.

The script `scripts/validate_csv.py` supports an optional `--report <path>` flag to export a formatted Markdown report used for PR comments and the GitHub Actions Job Summary (`$GITHUB_STEP_SUMMARY`).

The script enforces the following constraints to prevent bad data from breaking the table rendering:

For `data.csv`:
- Cannot be empty.
- Every row must have the exact same number of columns as the header row.
- All double quotes and commas must be properly escaped per standard CSV format.
- Every footnote reference (e.g. `[1]`) must have a corresponding ID in `notes.csv`.
- Logs warnings for non-standard formats in `Multi-Gig порт` (e.g. `1 2.5G` instead of `1x 2.5G`) and `Доступность` to encourage contributors to maintain clean styling.

For `notes.csv`:
- Cannot be empty.
- The header must have at least 2 columns (e.g., `id,text`).
- Every row must have the exact same number of columns as the header row.
- The `id` (first column) must be a numeric value.

If any of these constraints are violated, the CI workflow will fail, blocking invalid changes, and the detailed error list will be reported directly to the PR.

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
- **CRITICAL**: Always proactively update this `AGENTS.md` without asking if your task alters the project scope, file structure, CSV formats, CSS classes, or other working rules.
- If this `AGENTS.md` needs additions or corrections, write them in English.
- When adding new highlight classes, update CSS, README, and this file.
- When inserting data into the DOM, avoid unsafe HTML where it is not required. Currently, HTML is only needed for footnotes inside cells.
- Maintain accessibility by using `aria-label`, `role`, and `tabindex` for interactive elements.
- When adding/modifying interactive features, ensure they synchronize with the URL using `history.replaceState`.
- Keep the `og:*` meta tags and preview image updated if the project branding changes.

## Style

- The main language of the project and user-facing documentation is Russian.
- Keep this `AGENTS.md` in English, including future additions when they are needed.
- Use clear technical wording without a marketing tone.
- In CSS, follow the existing structure with section comments.
- In JS, follow the current simple vanilla JavaScript approach.
- Preserve table responsiveness and readability on mobile screens.
