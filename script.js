const table = document.getElementById("compare-table");

table.querySelectorAll("td, th").forEach(cell => {
    cell.addEventListener("mouseenter", () => {
        const index = cell.cellIndex;
        table.querySelectorAll("tr").forEach(row => {
            if (row.cells[index]) {
                row.cells[index].classList.add("hover-col");
            }
        });
    });

    cell.addEventListener("mouseleave", () => {
        table.querySelectorAll(".hover-col")
            .forEach(c => c.classList.remove("hover-col"));
    });
});
