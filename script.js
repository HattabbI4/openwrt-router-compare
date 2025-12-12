fetch("data.csv")
    .then(r => r.text())
    .then(text => buildTable(parseCSV(text)));

function parseCSV(text) {
    return text
        .trim()
        .split("\n")
        .map(row => row.split(",").map(c => c.trim()));
}

function buildTable(rows) {
    const table = document.getElementById("compare-table");

    const header = rows[0];
    const thead = document.createElement("thead");
    thead.innerHTML =
    "<tr>" +
    header.map(h => `<th>${h}</th>`).join("") +
    "</tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.slice(1).forEach(row => {
        const tr = document.createElement("tr");

        row.forEach((cell, i) => {
            const td = document.createElement("td");

            if (cell.includes("|")) {
                const [text, cls] = cell.split("|");
                td.textContent = text;
                td.className = cls;
            } else {
                td.textContent = cell;
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    enableColumnHover(table);
}

function enableColumnHover(table) {
    table.querySelectorAll("td, th").forEach(cell => {
        cell.addEventListener("mouseenter", () => {
            const i = cell.cellIndex;
            table.querySelectorAll("tr").forEach(r => {
                if (r.cells[i]) {
                    r.cells[i].classList.add("hover-col");
                }
            });
        });

        cell.addEventListener("mouseleave", () => {
            table.querySelectorAll(".hover-col")
                .forEach(c => c.classList.remove("hover-col"));
        });
    });
}
