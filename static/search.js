"use strict";

(() => {
    // The same transliteration as the cookbook's German alphabetical index.
    function normalize(value) {
        return String(value ?? "").toLowerCase()
            .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
            .replace(/ß/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    }

    const root = document.querySelector("[data-search-index]");
    if (!root) return;
    const controls = document.getElementById("search-controls");
    const input = document.getElementById("recipe-search");
    const status = document.getElementById("search-status");
    const tagLabel = document.getElementById("search-tag");
    const clear = document.getElementById("search-clear");
    const reset = document.getElementById("search-reset");
    const cards = [...document.querySelectorAll("[data-recipe-id]")];
    const categories = [...document.querySelectorAll(".category-board-card")];
    const boards = [...document.querySelectorAll(".category-board")];
    const counts = new Map(categories.map(category => [category,
        category.querySelector(".category-count").textContent]));
    let activeTag = "";

    function readURL() {
        const params = new URL(window.location.href).searchParams;
        input.value = params.get("q") || "";
        activeTag = params.get("tag") || "";
    }

    function restoreCards() {
        [...cards, ...categories, ...boards].forEach(element => { element.hidden = false; });
        categories.forEach(category => {
            category.querySelector(".category-count").textContent = counts.get(category);
        });
    }

    async function start() {
        try {
            const response = await fetch(root.dataset.searchIndex);
            if (!response.ok) throw new Error("Index unavailable");
            const records = await response.json();
            if (!Array.isArray(records) || records.length !== cards.length) throw new Error("Invalid index");
            const indexed = new Map();
            for (const record of records) {
                if (!record || !Number.isInteger(record.id) || typeof record.title !== "string" ||
                    typeof record.url !== "string") throw new Error("Invalid recipe");
                indexed.set(String(record.id), {
                    text: normalize([record.title, record.category, record.ingredients,
                        record.steps, record.tags].join(" ")),
                    tags: String(record.tags ?? "").split(",").map(tag => normalize(tag.trim())),
                });
            }
            if (indexed.size !== cards.length || cards.some(card => !indexed.has(card.dataset.recipeId))) {
                throw new Error("Index and page differ");
            }

            function apply(updateURL) {
                const terms = normalize(input.value).trim().split(/\s+/).filter(Boolean);
                const tag = normalize(activeTag.trim());
                const filtering = terms.length > 0 || tag !== "";
                clear.hidden = input.value.length === 0;
                reset.hidden = !filtering;
                let visible = 0;
                cards.forEach(card => {
                    const recipe = indexed.get(card.dataset.recipeId);
                    card.hidden = !terms.every(term => recipe.text.includes(term)) ||
                        (tag !== "" && !recipe.tags.includes(tag));
                    if (!card.hidden) visible += 1;
                });
                categories.forEach(category => {
                    const count = [...category.querySelectorAll("[data-recipe-id]")]
                        .filter(card => !card.hidden).length;
                    category.hidden = count === 0;
                    category.querySelector(".category-count").textContent = filtering
                        ? `${count} ${count === 1 ? "Rezept" : "Rezepte"}` : counts.get(category);
                });
                boards.forEach(board => {
                    board.hidden = [...board.querySelectorAll(".category-board-card")]
                        .every(category => category.hidden);
                });
                tagLabel.hidden = !tag;
                tagLabel.textContent = tag ? `Tag: ${activeTag}` : "";
                status.hidden = !filtering;
                status.textContent = visible === 0 ? "Keine passenden Rezepte gefunden. Bitte Filter zurücksetzen oder ändern."
                    : `${visible} ${visible === 1 ? "Rezept gefunden" : "Rezepte gefunden"}.`;
                if (updateURL) {
                    const url = new URL(window.location.href);
                    if (input.value.trim()) url.searchParams.set("q", input.value);
                    else url.searchParams.delete("q");
                    if (activeTag) url.searchParams.set("tag", activeTag);
                    else url.searchParams.delete("tag");
                    window.history.replaceState(null, "", url);
                }
            }

            readURL();
            apply(false);
            controls.hidden = false;
            input.addEventListener("input", () => apply(true));
            clear.addEventListener("click", () => {
                input.value = "";
                apply(true);
                input.focus();
            });
            reset.addEventListener("click", () => {
                input.value = "";
                activeTag = "";
                apply(true);
                input.focus();
            });
            window.addEventListener("popstate", () => { readURL(); apply(false); });
            // Preserve text search when selecting another tag on the overview.
            root.closest(".board-page").addEventListener("click", event => {
                const link = event.target.closest("a.tag-chip");
                if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                const url = new URL(link.href);
                if (input.value.trim()) url.searchParams.set("q", input.value);
                window.history.pushState(null, "", url);
                readURL();
                apply(false);
            });
        } catch (error) {
            controls.hidden = true;
            restoreCards();
            status.hidden = false;
            status.textContent = "Suche und Tag-Filter sind gerade nicht verfügbar. Alle Rezepte und das Inhaltsverzeichnis bleiben nutzbar.";
        }
    }
    start();
})();
