/* =====================
   THEME LOGIC
===================== */

const themeSwitch = document.getElementById("theme-switch");
const themeSwitchBtns = document.querySelectorAll(".theme-switch-btn");
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

let currentThemeMode = localStorage.getItem("theme");
if (!["light", "dark", "system"].includes(currentThemeMode)) {
    currentThemeMode = "system";
}

function updateTheme() {
    const effective = currentThemeMode === "system" ? (mediaQuery.matches ? "dark" : "light") : currentThemeMode;
    document.documentElement.setAttribute("data-theme", effective);
    if (themeSwitch) themeSwitch.setAttribute("data-state", currentThemeMode);
    themeSwitchBtns.forEach(btn => {
        const isCurrent = btn.dataset.themeVal === currentThemeMode;
        btn.classList.toggle("active", isCurrent);
        btn.setAttribute("aria-checked", String(isCurrent));
    });
}

updateTheme();

themeSwitchBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const val = btn.dataset.themeVal;
        if (val && val !== currentThemeMode) {
            currentThemeMode = val;
            localStorage.setItem("theme", currentThemeMode);
            updateTheme();
        }
    });
});

mediaQuery.addEventListener("change", () => {
    if (currentThemeMode === "system") updateTheme();
});

/* =====================
   DATA LOADING & PARSING
===================== */

Promise.all([
    fetch("data.csv").then(r => { if (!r.ok) throw new Error("data.csv"); return r.text(); }),
    fetch("notes.csv").then(r => { if (!r.ok) throw new Error("notes.csv"); return r.text(); })
]).then(([dataText, notesText]) => {
    const data = parseCSV(dataText);
    const notes = parseNotes(notesText);
    buildTable(data, notes);
    renderNotes(notes);
}).catch(() => {
    const wrap = document.querySelector(".table-wrap");
    if (wrap) {
        wrap.innerHTML = '<p style="padding: 24px; text-align: center; color: var(--muted);">⚠ Ошибка загрузки данных. Попробуйте обновить страницу.</p>';
    }
});

function parseCSV(text) {
    // shortcut: CSV parsing handles standard quotes and commas; complex embedded newlines not supported
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (inQuotes && text[i + 1] === '"') { cell += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
            row.push(cell.trim()); cell = "";
        } else if ((c === '\n' || c === '\r') && !inQuotes) {
            if (row.length || cell) { row.push(cell.trim()); rows.push(row); }
            row = []; cell = "";
        } else {
            cell += c;
        }
    }
    if (row.length || cell) { row.push(cell.trim()); rows.push(row); }
    return rows;
}

function parseNotes(text) {
    const rows = parseCSV(text);
    const notes = {};
    rows.slice(1).forEach(([id, content]) => {
        if (id) notes[id] = content;
    });
    return notes;
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function pluralRouters(count) {
    const mod10 = count % 10, mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return "устройств";
    if (mod10 === 1) return "устройство";
    if (mod10 >= 2 && mod10 <= 4) return "устройства";
    return "устройств";
}

/* =====================
   FORMATTERS & FILTERS
===================== */

const FILTERS = {
    wifi7: tr => /Wi-Fi 7/i.test(tr.cells[4]?.textContent || ""),
    wifi6: tr => /Wi-Fi 6/i.test(tr.cells[4]?.textContent || ""),
    multigig: tr => /(?:2[.,]5|5|10)\s*(?:g|г|gbe|gbps|гбит)/i.test(tr.cells[8]?.textContent || ""),
    usb3: tr => /USB 3/i.test(tr.cells[9]?.textContent || ""),
    retail: tr => /маркетплейс|розниц|рф/i.test(tr.cells[14]?.textContent || ""),
    compact: tr => /Компактный/i.test(tr.cells[13]?.textContent || "")
};

function renderFootnotes(text, notes) {
    return text.replace(/\[(\d+)\]/g, (_, n) => {
        const note = notes[n] || "";
        return `<sup id="sup-${n}" data-note="${n}" title="[${n}] ${escapeHTML(note)}" tabindex="0" role="button" aria-label="Примечание ${n}"><a href="#note-${n}">${n}</a></sup>`;
    });
}

function formatCell(text, colIdx, notes) {
    const rendered = renderFootnotes(text, notes);
    const clean = text.trim();

    if (colIdx === 8) {
        if (/^(?:нет|-|—|none)$/i.test(clean)) return `<span class="dimmed">${rendered}</span>`;
        if (/10\s*(?:g|г|gbe|gbps|гбит)/i.test(clean)) return `<span class="tag-speed tag-10g">${rendered}</span>`;
        if (/(?:2[.,]5|5)\s*(?:g|г|gbe|gbps|гбит)/i.test(clean)) return `<span class="tag-speed tag-25g">${rendered}</span>`;
    }

    if (colIdx === 14) {
        if (/маркетплейс|розниц|рф/i.test(clean)) return `<span class="avail-tag"><span class="dot dot-green"></span>${rendered}</span>`;
        if (/китай|aliexpress|али/i.test(clean)) return `<span class="avail-tag"><span class="dot dot-amber"></span>${rendered}</span>`;
        if (/снят|архив/i.test(clean)) return `<span class="avail-tag avail-disc"><span class="dot dot-gray"></span>${rendered}</span>`;
    }

    return rendered;
}

/* =====================
   TABLE BUILDER
===================== */

function buildTable(rows, notes) {
    const table = document.getElementById("compare-table");
    const totalRows = rows.length - 1;

    const totalBadge = document.getElementById("total-routers-badge");
    if (totalBadge) totalBadge.textContent = `${totalRows} ${pluralRouters(totalRows)}`;

    // thead
    const thead = document.createElement("thead");
    const htr = document.createElement("tr");
    rows[0].forEach((h, i) => {
        const th = document.createElement("th");
        th.textContent = h;
        th.dataset.col = i;
        th.setAttribute("role", "button");
        th.setAttribute("tabindex", "0");
        th.setAttribute("aria-label", `Сортировать по: ${h}`);
        th.setAttribute("aria-sort", "none");
        htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    // tbody
    const tbody = document.createElement("tbody");
    rows.slice(1).forEach(row => {
        const tr = document.createElement("tr");
        row.forEach((cell, i) => {
            const td = document.createElement("td");
            let text = cell;
            const match = cell.match(/\|(good|warn)/);
            if (match) {
                td.className = match[1];
                text = cell.replace(match[0], "");
            }

            if (i === 0) {
                const model = text.replace(/\[\d+\]/g, "").trim();
                tr.dataset.model = model;
                td.innerHTML = `
                    <div class="model-cell-content">
                        <input type="checkbox" class="compare-checkbox" data-model="${escapeHTML(model)}" aria-label="Сравнить ${escapeHTML(model)}">
                        <span class="model-name">${renderFootnotes(text, notes)}</span>
                    </div>`;
            } else {
                td.innerHTML = formatCell(text, i, notes);
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Update chip counters
    const chipCounts = { all: totalRows };
    for (const key in FILTERS) {
        chipCounts[key] = Array.from(tbody.querySelectorAll("tr")).filter(FILTERS[key]).length;
    }
    document.querySelectorAll(".filter-chips .chip").forEach(b => {
        const cnt = chipCounts[b.dataset.filter];
        const span = b.querySelector(".chip-count");
        if (span && cnt !== undefined) span.textContent = cnt;
    });

    initInteractions(table, notes);
}

/* =====================
   INTERACTIONS & STATE
===================== */

function initInteractions(table, notes) {
    const input = document.getElementById("search-input");
    const clearBtn = document.getElementById("search-clear");
    const countEl = document.getElementById("search-count");
    const chipBtns = document.querySelectorAll(".filter-chips .chip");
    const compareBar = document.getElementById("compare-bar");
    const compareCountEl = document.getElementById("compare-count");
    const compareToggleBtn = document.getElementById("compare-toggle-btn");
    const diffToggleBtn = document.getElementById("diff-toggle-btn");
    const compareClearBtn = document.getElementById("compare-clear-btn");
    const emptyState = document.getElementById("empty-state");
    const emptyResetBtn = document.getElementById("empty-reset-btn");
    const tbody = table.querySelector("tbody");
    const headers = table.querySelectorAll("thead th");
    const wrap = document.querySelector(".table-wrap");

    // Initial state from URL
    const params = new URLSearchParams(window.location.search);
    let query = params.get("q") || "";
    let activeChips = new Set(params.get("f") ? params.get("f").split(",").map(s => s.trim()).filter(Boolean) : []);
    let selectedModels = new Set(params.get("compare") ? params.get("compare").split(",").map(s => s.trim()).filter(Boolean) : []);
    let isCompareOnly = params.get("only") === "1";
    let isDiffMode = false;
    let sortCol = params.get("sort") !== null ? parseInt(params.get("sort"), 10) : -1;
    let sortAsc = params.get("dir") !== "desc";

    const updateURL = () => {
        const p = new URLSearchParams();
        if (query) p.set("q", query);
        if (activeChips.size > 0) p.set("f", Array.from(activeChips).join(","));
        if (selectedModels.size > 0) p.set("compare", Array.from(selectedModels).join(","));
        if (isCompareOnly) p.set("only", "1");
        if (sortCol >= 0 && sortCol < headers.length) {
            p.set("sort", sortCol);
            p.set("dir", sortAsc ? "asc" : "desc");
        }
        const qs = p.toString();
        window.history.replaceState({}, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    };

    const updateDiffHighlights = () => {
        const visibleRows = Array.from(tbody.querySelectorAll("tr:not([hidden])"));
        if (!isDiffMode || !isCompareOnly || visibleRows.length < 2) {
            table.classList.remove("diff-mode");
            if (diffToggleBtn) diffToggleBtn.classList.remove("active");
            tbody.querySelectorAll(".diff-same, .diff-diff").forEach(td => td.classList.remove("diff-same", "diff-diff"));
            return;
        }

        table.classList.add("diff-mode");
        if (diffToggleBtn) diffToggleBtn.classList.add("active");

        const cols = visibleRows[0].cells.length;
        for (let col = 1; col < cols; col++) {
            const first = visibleRows[0].cells[col].textContent.trim();
            const same = visibleRows.every(r => r.cells[col].textContent.trim() === first);
            visibleRows.forEach(r => {
                const td = r.cells[col];
                td.classList.toggle("diff-same", same);
                td.classList.toggle("diff-diff", !same);
            });
        }
    };

    const applyFilters = () => {
        const q = query.toLowerCase().trim();
        const trs = Array.from(tbody.querySelectorAll("tr"));
        let visibleCount = 0;

        trs.forEach(tr => {
            const model = tr.dataset.model || "";
            const isSelected = selectedModels.has(model);

            let match = !q || tr.textContent.toLowerCase().includes(q);
            if (match && activeChips.size > 0) {
                for (const chip of activeChips) {
                    if (FILTERS[chip] && !FILTERS[chip](tr)) { match = false; break; }
                }
            }
            if (match && isCompareOnly) {
                match = isSelected;
            }

            tr.hidden = !match;
            tr.classList.toggle("compare-selected", isSelected);
            const cb = tr.querySelector(".compare-checkbox");
            if (cb) cb.checked = isSelected;
            if (match) visibleCount++;
        });

        // Search feedback
        if (countEl) {
            if (isCompareOnly) countEl.textContent = `Сравнение: ${visibleCount} из ${trs.length}`;
            else if (q || activeChips.size > 0) countEl.textContent = `${visibleCount} из ${trs.length}`;
            else countEl.textContent = "";
        }

        if (clearBtn) clearBtn.hidden = !query;
        const wrapper = input?.closest(".search-wrapper");
        if (wrapper) wrapper.classList.toggle("has-value", Boolean(query));
        if (emptyState) emptyState.hidden = visibleCount > 0;

        // Chip button states
        chipBtns.forEach(b => {
            const f = b.dataset.filter;
            b.classList.toggle("active", f === "all" ? activeChips.size === 0 : activeChips.has(f));
        });

        // Compare bar states
        if (compareBar) {
            const count = selectedModels.size;
            compareBar.hidden = count === 0;
            if (compareCountEl) compareCountEl.textContent = count;
            if (compareToggleBtn) {
                compareToggleBtn.textContent = isCompareOnly ? "Показать все" : "Только выбранные";
                compareToggleBtn.classList.toggle("active", isCompareOnly);
            }
            if (diffToggleBtn) {
                diffToggleBtn.hidden = !isCompareOnly || count < 2;
            }
        }

        updateDiffHighlights();
        updateURL();
    };

    // Capacity sort helper
    const toMB = s => (parseFloat(s) || 0) * (/g|г/i.test(s) ? 1024 : 1);

    const sortTable = (col, isAsc) => {
        sortCol = col;
        sortAsc = isAsc;
        headers.forEach((th, i) => {
            const active = i === col;
            th.classList.toggle("active-sort", active);
            th.classList.toggle("sort-asc", active && isAsc);
            th.classList.toggle("sort-desc", active && !isAsc);
            th.setAttribute("aria-sort", active ? (isAsc ? "ascending" : "descending") : "none");
        });

        const trs = Array.from(tbody.querySelectorAll("tr"));
        trs.sort((a, b) => {
            let vA = a.cells[col].textContent.trim();
            let vB = b.cells[col].textContent.trim();
            if (col === 5 || col === 6) {
                const diff = toMB(vA) - toMB(vB);
                if (diff !== 0) return isAsc ? diff : -diff;
            }
            return isAsc
                ? vA.localeCompare(vB, undefined, { numeric: true, sensitivity: "base" })
                : vB.localeCompare(vA, undefined, { numeric: true, sensitivity: "base" });
        });
        trs.forEach(tr => tbody.appendChild(tr));
        updateURL();
    };

    // Header sort events
    headers.forEach((th, i) => {
        const toggle = () => sortTable(i, sortCol === i ? !sortAsc : true);
        th.addEventListener("click", toggle);
        th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });

    // Checkbox delegation
    tbody.addEventListener("change", e => {
        if (e.target.classList.contains("compare-checkbox")) {
            const m = e.target.dataset.model;
            if (e.target.checked) selectedModels.add(m);
            else {
                selectedModels.delete(m);
                if (selectedModels.size === 0) { isCompareOnly = false; isDiffMode = false; }
            }
            applyFilters();
        }
    });

    // Column hover via delegation on table
    table.addEventListener("mouseover", e => {
        const cell = e.target.closest("td, th");
        if (!cell) return;
        const i = cell.cellIndex;
        table.querySelectorAll("tr").forEach(r => r.cells[i]?.classList.add("hover-col"));
    });
    table.addEventListener("mouseout", () => {
        table.querySelectorAll(".hover-col").forEach(c => c.classList.remove("hover-col"));
    });

    // Sticky scroll watcher
    if (wrap) {
        const checkScroll = () => wrap.classList.toggle("scrolled", wrap.scrollLeft > 2);
        wrap.addEventListener("scroll", checkScroll, { passive: true });
        window.addEventListener("resize", checkScroll, { passive: true });
        checkScroll();
    }

    // Compare actions
    if (compareToggleBtn) {
        compareToggleBtn.addEventListener("click", () => {
            isCompareOnly = !isCompareOnly;
            if (!isCompareOnly) isDiffMode = false;
            applyFilters();
        });
    }

    if (diffToggleBtn) {
        diffToggleBtn.addEventListener("click", () => {
            isDiffMode = !isDiffMode;
            updateDiffHighlights();
        });
    }

    if (compareClearBtn) {
        compareClearBtn.addEventListener("click", () => {
            selectedModels.clear();
            isCompareOnly = false;
            isDiffMode = false;
            applyFilters();
        });
    }

    // Filter chips
    chipBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const f = btn.dataset.filter;
            if (f === "all") activeChips.clear();
            else if (activeChips.has(f)) activeChips.delete(f);
            else activeChips.add(f);
            applyFilters();
        });
    });

    // Reset everything
    const resetAll = () => {
        query = "";
        if (input) input.value = "";
        activeChips.clear();
        selectedModels.clear();
        isCompareOnly = false;
        isDiffMode = false;
        applyFilters();
    };

    if (emptyResetBtn) emptyResetBtn.addEventListener("click", resetAll);

    // Search events & Hotkeys
    if (input) {
        input.value = query;
        input.addEventListener("input", e => { query = e.target.value; applyFilters(); });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (input) { input.value = ""; query = ""; applyFilters(); input.focus(); }
        });
    }

    window.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            const tt = document.getElementById("footnote-tooltip");
            if (tt) tt.hidden = true;
            if (query && input) { query = ""; input.value = ""; applyFilters(); }
            if (document.activeElement?.blur) document.activeElement.blur();
        } else if ((e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) &&
                   input && document.activeElement !== input &&
                   !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
            e.preventDefault();
            input.focus();
            input.select();
        }
    });

    // Share button
    document.getElementById("share-btn")?.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            const lbl = document.querySelector(".share-label");
            const orig = lbl ? lbl.textContent : "Поделиться";
            if (lbl) lbl.textContent = "Скопировано! ✓";
            setTimeout(() => { if (lbl) lbl.textContent = orig; }, 2000);
        } catch (_) {}
    });

    // Tooltip logic
    initTooltip(notes);

    // Initial sort & filter run
    if (sortCol >= 0 && sortCol < headers.length) {
        sortTable(sortCol, sortAsc);
    }
    applyFilters();
}

/* =====================
   NOTES & TOOLTIP
===================== */

function renderNotes(notes) {
    const list = document.getElementById("notes-list");
    if (!list) return;
    list.innerHTML = Object.entries(notes)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([id, text]) => {
            const safe = escapeHTML(text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
            return `<li id="note-${id}">[${id}] ${safe} <a href="#sup-${id}" class="note-backlink" title="Вернуться к таблице">↑ к таблице</a></li>`;
        }).join("");
}

function initTooltip(notes) {
    const tooltip = document.getElementById("footnote-tooltip");
    if (!tooltip) return;

    let hideTimer = null;

    const show = (sup) => {
        clearTimeout(hideTimer);
        const id = sup.dataset.note;
        const text = notes[id];
        if (!text) return;

        const safe = escapeHTML(text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        tooltip.innerHTML = `<strong>Примечание [${id}]:</strong> ${safe}`;
        tooltip.hidden = false;

        const r = sup.getBoundingClientRect();
        const tw = tooltip.offsetWidth || 280;
        const th = tooltip.offsetHeight || 44;

        let left = r.left + (r.width / 2) - (tw / 2);
        if (left < 10) left = 10;
        if (left + tw > window.innerWidth - 10) left = window.innerWidth - tw - 10;

        let top = r.top - th - 6;
        if (top < 10) top = r.bottom + 6;

        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    };

    const hide = () => { hideTimer = setTimeout(() => { tooltip.hidden = true; }, 150); };

    tooltip.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    tooltip.addEventListener("mouseleave", hide);

    document.querySelectorAll("sup[data-note]").forEach(sup => {
        sup.addEventListener("mouseenter", () => show(sup));
        sup.addEventListener("mouseleave", hide);
        sup.addEventListener("focus", () => show(sup));
        sup.addEventListener("blur", hide);
        sup.addEventListener("click", () => {
            tooltip.hidden = true;
            const target = document.getElementById(`note-${sup.dataset.note}`);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
        });
    });

    window.addEventListener("scroll", () => { tooltip.hidden = true; }, { passive: true });
}
