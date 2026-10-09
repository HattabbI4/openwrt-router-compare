/* =====================
   THEME LOGIC
===================== */

const themeSwitch = document.getElementById("theme-switch");
const themeSwitchBtns = document.querySelectorAll(".theme-switch-btn");
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

let currentThemeMode = localStorage.getItem("theme");
if (currentThemeMode !== "light" && currentThemeMode !== "dark" && currentThemeMode !== "system") {
    currentThemeMode = "system";
}

function getSystemTheme() {
    return mediaQuery.matches ? "dark" : "light";
}

function updateTheme() {
    const effectiveTheme = currentThemeMode === "system" ? getSystemTheme() : currentThemeMode;
    document.documentElement.setAttribute("data-theme", effectiveTheme);

    if (themeSwitch) {
        themeSwitch.setAttribute("data-state", currentThemeMode);
    }

    themeSwitchBtns.forEach(btn => {
        const isCurrent = btn.dataset.themeVal === currentThemeMode;
        btn.classList.toggle("active", isCurrent);
        btn.setAttribute("aria-checked", isCurrent ? "true" : "false");
    });
}

updateTheme();

themeSwitchBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const targetTheme = btn.dataset.themeVal;
        if (targetTheme && targetTheme !== currentThemeMode) {
            currentThemeMode = targetTheme;
            localStorage.setItem("theme", currentThemeMode);
            updateTheme();
        }
    });
});

mediaQuery.addEventListener("change", () => {
    if (currentThemeMode === "system") {
        updateTheme();
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
   NOTES & FORMATTING
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
            ? `<sup data-note="${n}" tabindex="0" role="button" aria-label="Примечание ${n}">${n}</sup>`
            : `<sup>${n}</sup>`;
    });
}

function formatCellContent(text, colIdx, notes) {
    const rendered = renderFootnotes(text, notes);
    const clean = text.trim();

    // Multi-Gig column (col 8)
    if (colIdx === 8) {
        if (/^(?:нет|-|—|none)$/i.test(clean)) {
            return `<span class="dimmed">${rendered}</span>`;
        }
        // 10G variations
        if (/10\s*(?:g|г|gbe|gbps|гбит)/i.test(clean)) {
            return `<span class="tag-speed tag-10g">${rendered}</span>`;
        }
        // 2.5G / 5G variations
        if (/(?:2[.,]5|5)\s*(?:g|г|gbe|gbps|гбит)/i.test(clean)) {
            return `<span class="tag-speed tag-25g">${rendered}</span>`;
        }
    }

    // Availability column (col 14)
    if (colIdx === 14) {
        if (/маркетплейс|розниц|рф/i.test(clean)) {
            return `<span class="avail-tag"><span class="dot dot-green"></span>${rendered}</span>`;
        }
        if (/китай|aliexpress|али/i.test(clean)) {
            return `<span class="avail-tag"><span class="dot dot-amber"></span>${rendered}</span>`;
        }
        if (/снят|архив/i.test(clean)) {
            return `<span class="avail-tag avail-disc"><span class="dot dot-gray"></span>${rendered}</span>`;
        }
    }

    return rendered;
}

function pluralRouters(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return "устройств";
    if (mod10 === 1) return "устройство";
    if (mod10 >= 2 && mod10 <= 4) return "устройства";
    return "устройств";
}

/* =====================
   TABLE BUILDER
===================== */

function buildTable(rows, notes) {
    const table = document.getElementById("compare-table");
    const totalRows = rows.length - 1;

    // Header badge
    const totalBadge = document.getElementById("total-routers-badge");
    if (totalBadge) {
        totalBadge.textContent = `${totalRows} ${pluralRouters(totalRows)}`;
    }

    // Calculate chip counters
    const chipCounts = {
        all: totalRows,
        wifi7: 0,
        wifi6: 0,
        multigig: 0,
        usb3: 0,
        retail: 0,
        compact: 0
    };

    rows.slice(1).forEach(row => {
        if (/Wi-Fi 7/i.test(row[4] || "")) chipCounts.wifi7++;
        if (/Wi-Fi 6/i.test(row[4] || "")) chipCounts.wifi6++;
        if (/(?:2[.,]5|5|10)\s*(?:g|г|gbe|gbps|гбит)/i.test(row[8] || "")) chipCounts.multigig++;
        if (/USB 3\.0/i.test(row[9] || "")) chipCounts.usb3++;
        if (/маркетплейс|розниц|рф/i.test(row[14] || "")) chipCounts.retail++;
        if (/Компактный/i.test(row[13] || "")) chipCounts.compact++;
    });

    document.querySelectorAll(".filter-chips .chip").forEach(btn => {
        const filter = btn.dataset.filter;
        const countSpan = btn.querySelector(".chip-count");
        if (countSpan && chipCounts[filter] !== undefined) {
            countSpan.textContent = chipCounts[filter];
        }
    });

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    rows[0].forEach((h) => {
        const th = document.createElement("th");
        th.textContent = h;
        th.setAttribute("role", "button");
        th.setAttribute("tabindex", "0");
        th.setAttribute("aria-label", `Сортировать по: ${h}`);
        th.setAttribute("aria-sort", "none");
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.slice(1).forEach(row => {
        const tr = document.createElement("tr");

        row.forEach((cell, cellIdx) => {
            const td = document.createElement("td");

            let text = cell;
            let cls = "";

            const match = cell.match(/\|(good|warn)/);
            if (match) {
                cls = match[1];
                text = cell.replace(match[0], "");
            }

            td.className = cls;

            if (cellIdx === 0) {
                const modelName = text.replace(/\[\d+\]/g, "").trim();
                tr.dataset.model = modelName;
                const formattedName = renderFootnotes(text, notes);
                td.innerHTML = `
                    <div class="model-cell-content">
                        <label class="compare-checkbox-label" title="Выбрать для сравнения">
                            <input type="checkbox" class="compare-checkbox" data-model="${escapeHTML(modelName)}" aria-label="Сравнить ${escapeHTML(modelName)}">
                        </label>
                        <span class="model-name">${formattedName}</span>
                    </div>
                `;
            } else {
                td.innerHTML = formatCellContent(text, cellIdx, notes);
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    enableColumnHover(table);
    enableFootnotes(notes);
    enableShareButton();
    enableStickyScrollWatcher();

    // Initialize state from URL params
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q") || "";
    const initialChip = params.get("f") || "all";
    const initialCompare = params.get("compare") ? params.get("compare").split(",").map(decodeURIComponent) : [];
    const initialOnly = params.get("only") === "1";
    const sortIdx = params.get("sort");
    const parsedIdx = sortIdx !== null && sortIdx !== "" ? parseInt(sortIdx, 10) : -1;
    const sortDir = params.get("dir") || "asc";

    enableFilteringAndCompare(table, initialQuery, initialChip, initialCompare, initialOnly);
    enableSorting(table, parsedIdx, sortDir === "asc");
}

/* =====================
   STICKY SCROLL SHADOW
===================== */

function enableStickyScrollWatcher() {
    const wrap = document.querySelector(".table-wrap");
    if (!wrap) return;

    const checkScroll = () => {
        wrap.classList.toggle("scrolled", wrap.scrollLeft > 2);
    };

    wrap.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll, { passive: true });
    checkScroll();
}

/* =====================
   RENDER NOTES
===================== */

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[m]));
}

function renderNotes(notes) {
    const list = document.getElementById("notes-list");
    list.innerHTML = "";

    Object.keys(notes)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach(id => {
            const li = document.createElement("li");
            li.id = `note-${id}`;
            li.value = id;

            const safeText = escapeHTML(notes[id]);
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const linkified = safeText.replace(urlRegex, url => {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
            });

            li.innerHTML = `${linkified} <a href="#compare-table" class="note-backlink" data-back="${id}" title="Вернуться к таблице">↑ к таблице</a>`;
            list.appendChild(li);
        });

    list.querySelectorAll(".note-backlink").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const id = link.dataset.back;
            const sup = document.querySelector(`sup[data-note="${id}"]`);
            if (sup) {
                sup.scrollIntoView({ behavior: "smooth", block: "center" });
                sup.style.outline = "2px solid var(--notes-bar)";
                setTimeout(() => {
                    sup.style.outline = "";
                }, 1500);
            } else {
                document.getElementById("compare-table").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
}

/* =====================
   INTERACTIONS
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

function enableFootnotes(notes) {
    const tooltip = document.getElementById("footnote-tooltip") || document.createElement("div");
    if (!tooltip.id) {
        tooltip.id = "footnote-tooltip";
        tooltip.className = "footnote-tooltip";
        tooltip.hidden = true;
        document.body.appendChild(tooltip);
    }

    let hideTimeout = null;

    const showTooltip = (sup) => {
        clearTimeout(hideTimeout);
        const id = sup.dataset.note;
        const text = notes[id];
        if (!text) return;

        const safeText = escapeHTML(text);
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const linkified = safeText.replace(urlRegex, url => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });

        tooltip.innerHTML = `<strong>Примечание [${id}]:</strong> ${linkified}`;
        tooltip.hidden = false;

        const rect = sup.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width || 280;
        const tooltipHeight = tooltipRect.height || 48;

        let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        if (left < 12) left = 12;
        if (left + tooltipWidth > window.innerWidth - 12) {
            left = window.innerWidth - tooltipWidth - 12;
        }

        let top = rect.top - tooltipHeight - 8;
        if (top < 10) {
            top = rect.bottom + 8;
        }

        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
        tooltip.style.transform = "none";
    };

    const scheduleHide = () => {
        hideTimeout = setTimeout(() => {
            tooltip.hidden = true;
        }, 150);
    };

    tooltip.addEventListener("mouseenter", () => clearTimeout(hideTimeout));
    tooltip.addEventListener("mouseleave", scheduleHide);

    const scrollToNote = (id) => {
        tooltip.hidden = true;
        const target = document.getElementById(`note-${id}`);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("note-active");
        setTimeout(() => target.classList.remove("note-active"), 2000);
    };

    document.querySelectorAll("sup[data-note]").forEach(sup => {
        sup.addEventListener("mouseenter", () => showTooltip(sup));
        sup.addEventListener("mouseleave", scheduleHide);
        sup.addEventListener("focus", () => showTooltip(sup));
        sup.addEventListener("blur", scheduleHide);

        sup.addEventListener("click", (e) => {
            e.stopPropagation();
            scrollToNote(sup.dataset.note);
        });

        sup.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                scrollToNote(sup.dataset.note);
            }
        });
    });

    window.addEventListener("scroll", () => { tooltip.hidden = true; }, { passive: true });
    const wrap = document.querySelector(".table-wrap");
    if (wrap) wrap.addEventListener("scroll", () => { tooltip.hidden = true; }, { passive: true });
}

function enableShareButton() {
    const btn = document.getElementById("share-btn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        const url = window.location.href;
        let copied = false;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(url);
                copied = true;
            } catch (_) {}
        }

        if (!copied) {
            const input = document.createElement("input");
            input.value = url;
            document.body.appendChild(input);
            input.select();
            copied = document.execCommand("copy");
            document.body.removeChild(input);
        }

        const label = btn.querySelector(".share-label");
        const origText = label ? label.textContent : "Поделиться";
        btn.classList.add("copied");
        if (label) label.textContent = "Скопировано! ✓";

        setTimeout(() => {
            btn.classList.remove("copied");
            if (label) label.textContent = origText;
        }, 2000);
    });
}

/* =====================
   FILTERING & COMPARE
===================== */

function enableFilteringAndCompare(table, initialQuery, initialChip, initialCompare, initialOnly) {
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

    const parseChips = (str) => {
        if (!str || str === "all") return new Set();
        return new Set(str.split(",").map(s => s.trim()).filter(Boolean));
    };

    let currentQuery = initialQuery;
    let activeChips = parseChips(initialChip);
    let isCompareOnly = initialOnly;
    let isDiffMode = false;
    const selectedModels = new Set(initialCompare);

    const updateURL = () => {
        const url = new URL(window.location);
        if (currentQuery) url.searchParams.set("q", currentQuery);
        else url.searchParams.delete("q");

        if (activeChips.size > 0) url.searchParams.set("f", Array.from(activeChips).join(","));
        else url.searchParams.delete("f");

        if (selectedModels.size > 0) {
            url.searchParams.set("compare", Array.from(selectedModels).map(encodeURIComponent).join(","));
        } else {
            url.searchParams.delete("compare");
        }

        if (isCompareOnly) url.searchParams.set("only", "1");
        else url.searchParams.delete("only");

        window.history.replaceState({}, "", url);
    };

    const updateDiffHighlights = () => {
        if (!isDiffMode || !isCompareOnly || selectedModels.size < 2) {
            table.classList.remove("diff-mode");
            tbody.querySelectorAll(".diff-same, .diff-diff").forEach(td => {
                td.classList.remove("diff-same", "diff-diff");
            });
            if (diffToggleBtn) diffToggleBtn.classList.remove("active");
            return;
        }

        table.classList.add("diff-mode");
        if (diffToggleBtn) diffToggleBtn.classList.add("active");

        const visibleRows = Array.from(tbody.querySelectorAll("tr:not(.hidden-row)"));
        if (visibleRows.length < 2) return;

        const colCount = visibleRows[0].cells.length;
        for (let col = 1; col < colCount; col++) {
            const firstVal = visibleRows[0].cells[col].innerText.trim();
            const isSame = visibleRows.every(r => r.cells[col].innerText.trim() === firstVal);

            visibleRows.forEach(r => {
                const td = r.cells[col];
                if (isSame) {
                    td.classList.add("diff-same");
                    td.classList.remove("diff-diff");
                } else {
                    td.classList.add("diff-diff");
                    td.classList.remove("diff-same");
                }
            });
        }
    };

    const updateCompareBar = () => {
        if (!compareBar) return;
        const count = selectedModels.size;
        if (count > 0) {
            compareBar.hidden = false;
            compareCountEl.textContent = count;
            if (compareToggleBtn) {
                compareToggleBtn.textContent = isCompareOnly ? "Показать все" : "Только выбранные";
                compareToggleBtn.classList.toggle("active", isCompareOnly);
            }
            if (diffToggleBtn) {
                diffToggleBtn.hidden = !isCompareOnly || count < 2;
            }
        } else {
            compareBar.hidden = true;
            isCompareOnly = false;
            isDiffMode = false;
            if (diffToggleBtn) diffToggleBtn.hidden = true;
        }
        updateDiffHighlights();
    };

    const applyFilters = () => {
        const rows = Array.from(tbody.querySelectorAll("tr"));
        let visible = 0;
        const q = currentQuery.toLowerCase().trim();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const model = row.dataset.model || "";
            const isSelected = selectedModels.has(model);

            // 1. Text query
            const matchesQuery = !q || text.includes(q);

            // 2. Multi-select chips
            let matchesChips = true;
            if (activeChips.has("wifi7") && !/Wi-Fi 7/i.test(row.cells[4]?.innerText || "")) matchesChips = false;
            if (activeChips.has("wifi6") && !/Wi-Fi 6/i.test(row.cells[4]?.innerText || "")) matchesChips = false;
            if (activeChips.has("multigig") && !/(?:2[.,]5|5|10)\s*(?:g|г|gbe|gbps|гбит)/i.test(row.cells[8]?.innerText || "")) matchesChips = false;
            if (activeChips.has("usb3") && !/USB 3\.0/i.test(row.cells[9]?.innerText || "")) matchesChips = false;
            if (activeChips.has("retail") && !/маркетплейс|розниц|рф/i.test(row.cells[14]?.innerText || "")) matchesChips = false;
            if (activeChips.has("compact") && !/Компактный/i.test(row.cells[13]?.innerText || "")) matchesChips = false;

            // 3. Compare mode
            let matchesCompare = true;
            if (isCompareOnly) {
                matchesCompare = isSelected;
            }

            const isVisible = matchesQuery && matchesChips && matchesCompare;
            row.classList.toggle("hidden-row", !isVisible);
            row.classList.toggle("compare-selected", isSelected);

            const checkbox = row.querySelector(".compare-checkbox");
            if (checkbox) checkbox.checked = isSelected;

            if (isVisible) visible++;
        });

        // Search count feedback
        if (isCompareOnly) {
            countEl.textContent = `Сравнение: ${visible} из ${rows.length}`;
        } else if (q || activeChips.size > 0) {
            countEl.textContent = `${visible} из ${rows.length}`;
        } else {
            countEl.textContent = "";
        }

        if (clearBtn) clearBtn.hidden = !currentQuery;

        const wrapper = input.closest(".search-wrapper");
        if (wrapper) wrapper.classList.toggle("has-value", Boolean(currentQuery));

        // Empty state
        if (emptyState) {
            emptyState.hidden = visible > 0;
        }

        // Update active chip UI
        chipBtns.forEach(b => {
            const filter = b.dataset.filter;
            if (filter === "all") {
                b.classList.toggle("active", activeChips.size === 0);
            } else {
                b.classList.toggle("active", activeChips.has(filter));
            }
        });

        updateCompareBar();
        updateURL();
    };

    // Checkbox changes inside rows
    tbody.addEventListener("change", (e) => {
        if (e.target.classList.contains("compare-checkbox")) {
            const model = e.target.dataset.model;
            if (e.target.checked) {
                selectedModels.add(model);
            } else {
                selectedModels.delete(model);
                if (selectedModels.size === 0) {
                    isCompareOnly = false;
                    isDiffMode = false;
                }
            }
            applyFilters();
        }
    });

    // Compare bar actions
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

    // Filter chips click
    chipBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const filter = btn.dataset.filter;
            if (filter === "all") {
                activeChips.clear();
            } else {
                if (activeChips.has(filter)) {
                    activeChips.delete(filter);
                } else {
                    activeChips.add(filter);
                }
            }
            applyFilters();
        });
    });

    // Reset everything
    const resetEverything = () => {
        let changed = false;
        if (currentQuery) {
            currentQuery = "";
            input.value = "";
            changed = true;
        }
        if (activeChips.size > 0) {
            activeChips.clear();
            changed = true;
        }
        if (selectedModels.size > 0 || isCompareOnly) {
            selectedModels.clear();
            isCompareOnly = false;
            isDiffMode = false;
            changed = true;
        }
        if (changed) {
            applyFilters();
        }
    };

    if (emptyResetBtn) {
        emptyResetBtn.addEventListener("click", resetEverything);
    }

    // Keyboard shortcuts: '/' or 'Ctrl+K' for search, 'Esc' to reset
    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const tooltip = document.getElementById("footnote-tooltip");
            if (tooltip) tooltip.hidden = true;
            resetEverything();
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }
        } else if ((e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) &&
                   document.activeElement !== input &&
                   document.activeElement.tagName !== "INPUT" &&
                   document.activeElement.tagName !== "TEXTAREA") {
            e.preventDefault();
            input.focus();
            input.select();
        }
    });

    // Search input events
    input.value = currentQuery;
    input.addEventListener("input", (e) => {
        currentQuery = e.target.value;
        applyFilters();
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            input.value = "";
            currentQuery = "";
            applyFilters();
            input.focus();
        });
    }

    applyFilters();
}

/* =====================
   SORTING
===================== */

function parseCapacityToMB(str) {
    if (!str) return 0;
    const regex = /(\d+(?:\.\d+)?)\s*(GB|MB|ГБ|МБ|G|M)/gi;
    let maxMB = 0;
    let match;
    while ((match = regex.exec(str)) !== null) {
        const num = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        let mb = num;
        if (unit.startsWith('G') || unit.startsWith('Г')) {
            mb = num * 1024;
        }
        if (mb > maxMB) maxMB = mb;
    }
    return maxMB;
}

function enableSorting(table, initialIdx = -1, initialAsc = true) {
    const headers = table.querySelectorAll("thead th");
    const tbody = table.querySelector("tbody");
    let currentSort = { index: initialIdx, asc: initialAsc };

    const performSort = (index, isAsc) => {
        headers.forEach(h => {
            h.classList.remove("sort-asc", "sort-desc", "active-sort");
            h.setAttribute("aria-sort", "none");
        });
        const th = headers[index];
        th.classList.add(isAsc ? "sort-asc" : "sort-desc", "active-sort");
        th.setAttribute("aria-sort", isAsc ? "ascending" : "descending");

        const rows = Array.from(tbody.querySelectorAll("tr"));
        rows.sort((a, b) => {
            let valA = a.cells[index].innerText.trim();
            let valB = b.cells[index].innerText.trim();

            // Ignore checkbox label in model column when sorting
            if (index === 0) {
                const nameA = a.querySelector(".model-name");
                const nameB = b.querySelector(".model-name");
                if (nameA) valA = nameA.innerText.trim();
                if (nameB) valB = nameB.innerText.trim();
            }

            // Smart capacity sorting for Flash (col 5) and RAM (col 6)
            if (index === 5 || index === 6) {
                const mbA = parseCapacityToMB(valA);
                const mbB = parseCapacityToMB(valB);
                if (mbA !== mbB) {
                    return isAsc ? mbA - mbB : mbB - mbA;
                }
            }

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

    if (Number.isInteger(initialIdx) && initialIdx >= 0 && initialIdx < headers.length) {
        performSort(initialIdx, initialAsc);
    }
}
