/* =====================
   THEME LOGIC
===================== */

const toggleBtn = document.getElementById("theme-toggle");
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    toggleBtn.textContent = theme === "dark" ? "☀" : "🌙";
}

function getSystemTheme() {
    return mediaQuery.matches ? "dark" : "light";
}

const storedTheme = localStorage.getItem("theme");
applyTheme(storedTheme || getSystemTheme());

toggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const newTheme = current === "dark" ? "light" : "dark";
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
});

mediaQuery.addEventListener("change", () => {
    if (!localStorage.getItem("theme")) {
        applyTheme(getSystemTheme());
    }
});

/* =====================
   DATA LOADING
===================== */

Promise.all([
    fetch("data.csv").then(r => {
        if (!r.ok) throw new Error("data.csv");
        return r.text();
    }),
    fetch("notes.csv").then(r => {
        if (!r.ok) throw new Error("notes.csv");
        return r.text();
    })
]).then(([dataText, notesText]) => {
    const data = parseCSV(dataText);
    const notes = parseNotes(notesText);

    buildTable(data, notes);
    renderNotes(notes);
}).catch(() => {
    const wrap = document.querySelector(".table-wrap");
    wrap.textContent = "";
    const msg = document.createElement("p");
    msg.className = "load-error";
    msg.textContent = "\u26A0 Ошибка загрузки данных. Попробуйте обновить страницу.";
    wrap.appendChild(msg);
});

/* =====================
   CSV PARSER
===================== */

function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            row.push(cell.trim());
            cell = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (row.length || cell) {
                row.push(cell.trim());
                rows.push(row);
            }
            row = [];
            cell = "";
        } else {
            cell += char;
        }
    }

    if (row.length || cell) {
        row.push(cell.trim());
        rows.push(row);
    }

    return rows;
}

/* =====================
   NOTES
===================== */

function parseNotes(text) {
    const rows = parseCSV(text);
    const notes = {};
    rows.slice(1).forEach(([id, content]) => {
        notes[id] = content;
    });
    return notes;
}

function renderFootnotes(text, notes) {
    return text.replace(/\[(\d+)\]/g, (_, n) => {
        return notes[n]
        ? `<sup data-note="${n}" title="${notes[n]}">${n}</sup>`
        : `<sup>${n}</sup>`;
    });
}

/* =====================
   TABLE
===================== */

function buildTable(rows, notes) {
    const table = document.getElementById("compare-table");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    rows[0].forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        th.setAttribute("role", "button");
        th.setAttribute("tabindex", "0");
        th.setAttribute("aria-label", `Сортировать по: ${h}`);
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.slice(1).forEach(row => {
        const tr = document.createElement("tr");

        row.forEach(cell => {
            const td = document.createElement("td");

            let text = cell;
            let cls = "";

            const match = cell.match(/\|(good|warn)/);
            if (match) {
                cls = match[1];
                text = cell.replace(match[0], "");
            }

            td.className = cls;
            td.innerHTML = renderFootnotes(text, notes);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    enableColumnHover(table);
    enableFootnoteClicks();
    
    // Initialize search and sort with URL state
    const params = new URLSearchParams(window.location.search);
    const query = params.get("q") || "";
    const sortIdx = params.get("sort");
    const sortDir = params.get("dir") || "asc";

    enableSearch(query);
    enableSorting(table, sortIdx !== null ? parseInt(sortIdx) : -1, sortDir === "asc");
}

/* =====================
   RENDER NOTES
===================== */

function renderNotes(notes) {
    const list = document.getElementById("notes-list");
    list.innerHTML = "";

    Object.keys(notes)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach(id => {
        const li = document.createElement("li");
        li.id = `note-${id}`;
        li.value = id;              // ← КЛЮЧЕВОЕ ИЗМЕНЕНИЕ
        li.textContent = notes[id];
        list.appendChild(li);
    });
}

/* =====================
   INTERACTION
===================== */

function enableColumnHover(table) {
    table.querySelectorAll("td, th").forEach(cell => {
        cell.addEventListener("mouseenter", () => {
            const i = cell.cellIndex;
            table.querySelectorAll("tr").forEach(r => {
                if (r.cells[i]) r.cells[i].classList.add("hover-col");
            });
        });

        cell.addEventListener("mouseleave", () => {
            table.querySelectorAll(".hover-col")
                .forEach(c => c.classList.remove("hover-col"));
        });
    });
}

function enableFootnoteClicks() {
    document.querySelectorAll("sup[data-note]").forEach(sup => {
        sup.addEventListener("click", () => {
            const id = sup.dataset.note;
            const target = document.getElementById(`note-${id}`);
            if (!target) return;

            target.scrollIntoView({ behavior: "smooth", block: "center" });
            target.classList.add("note-active");

            setTimeout(() => {
                target.classList.remove("note-active");
            }, 2000);
        });
    });
}

function enableSearch(initialQuery = "") {
    const input = document.getElementById("search-input");
    const clearBtn = document.getElementById("search-clear");
    const countEl = document.getElementById("search-count");
    const tbody = document.querySelector("#compare-table tbody");

    const performSearch = (query) => {
        const rows = Array.from(tbody.querySelectorAll("tr"));
        let visible = 0;

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const match = !query || text.includes(query.toLowerCase().trim());
            row.classList.toggle("hidden-row", !match);
            if (match) visible++;
        });

        countEl.textContent = query
            ? visible + " из " + rows.length
            : "";
            
        // Toggle clear button
        if (clearBtn) clearBtn.hidden = !query;

        // Update URL
        const url = new URL(window.location);
        if (query) url.searchParams.set("q", query);
        else url.searchParams.delete("q");
        window.history.replaceState({}, "", url);
    };

    input.value = initialQuery;
    if (initialQuery) performSearch(initialQuery);

    input.addEventListener("input", (e) => performSearch(e.target.value));
    
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            input.value = "";
            performSearch("");
            input.focus();
        });
    }
}

function enableSorting(table, initialIdx = -1, initialAsc = true) {
    const headers = table.querySelectorAll("thead th");
    const tbody = table.querySelector("tbody");
    let currentSort = { index: initialIdx, asc: initialAsc };

    const performSort = (index, isAsc) => {
        // Update UI
        headers.forEach(h => h.classList.remove("sort-asc", "sort-desc", "active-sort"));
        const th = headers[index];
        th.classList.add(isAsc ? "sort-asc" : "sort-desc", "active-sort");

        const rows = Array.from(tbody.querySelectorAll("tr"));
        rows.sort((a, b) => {
            const valA = a.cells[index].innerText.trim();
            const valB = b.cells[index].innerText.trim();
            return isAsc 
                ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
                : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
        });

        rows.forEach(row => tbody.appendChild(row));

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set("sort", index);
        url.searchParams.set("dir", isAsc ? "asc" : "desc");
        window.history.replaceState({}, "", url);
    };

    headers.forEach((th, index) => {
        const handleSort = () => {
            const isAsc = currentSort.index === index ? !currentSort.asc : true;
            performSort(index, isAsc);
            currentSort = { index, asc: isAsc };
        };

        th.addEventListener("click", handleSort);
        th.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSort();
            }
        });
    });

    if (initialIdx !== -1) {
        performSort(initialIdx, initialAsc);
    }
}
