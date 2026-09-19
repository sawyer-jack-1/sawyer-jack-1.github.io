(function () {
  "use strict";

  const shell = document.querySelector(".sawyertron-shell");
  if (!shell) return;

  const els = {
    archive: document.getElementById("archive-list"),
    mobileArchive: document.getElementById("mobile-archive-select"),
    feed: document.getElementById("paper-feed"),
    status: document.getElementById("sawyertron-status"),
    search: document.getElementById("paper-search"),
    from: document.getElementById("filter-from"),
    to: document.getElementById("filter-to"),
    author: document.getElementById("filter-author"),
    title: document.getElementById("filter-title"),
    topic: document.getElementById("filter-topic"),
    category: document.getElementById("filter-category"),
    advanced: document.getElementById("advanced-search"),
    apply: document.getElementById("apply-filters"),
    clear: document.getElementById("clear-filters")
  };

  const state = {
    index: null,
    currentMonth: null,
    papers: [],
    cache: new Map()
  };

  const normalize = (value) => (value || "").toLocaleLowerCase().trim();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function monthLabel(month) {
    const [year, number] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(Date.UTC(year, number - 1, 1)));
  }

  function dayLabel(date) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(date + "T12:00:00Z"));
  }

  function monthUrl(month) {
    return new URL(month + ".json", new URL(shell.dataset.indexUrl, window.location.href)).toString();
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error("Unable to load SawyerTRON data.");
    return response.json();
  }

  async function getMonth(month) {
    if (!state.cache.has(month)) {
      state.cache.set(month, fetchJson(monthUrl(month)));
    }
    return state.cache.get(month);
  }

  function archiveMonthsBetween(from, to) {
    if (!from && !to) return [state.currentMonth];
    const archived = state.index.months.map((entry) => entry.month);
    const lower = from ? from.slice(0, 7) : archived[archived.length - 1];
    const upper = to ? to.slice(0, 7) : archived[0];
    return state.index.months
      .map((entry) => entry.month)
      .filter((month) => month >= lower && month <= upper);
  }

  function buildArchive() {
    els.archive.replaceChildren();
    els.mobileArchive.replaceChildren();

    const byYear = new Map();
    state.index.months.forEach((entry) => {
      const year = entry.month.slice(0, 4);
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(entry);

      const option = element("option", "", `${monthLabel(entry.month)} (${entry.count})`);
      option.value = entry.month;
      option.selected = entry.month === state.currentMonth;
      els.mobileArchive.appendChild(option);
    });

    byYear.forEach((months, year) => {
      const details = element("details");
      details.open = months.some((entry) => entry.month === state.currentMonth);
      details.appendChild(element("summary", "", year));
      const list = element("ul", "sawyertron-months");
      months.forEach((entry) => {
        const item = element("li");
        const link = element("a", "", `${monthLabel(entry.month).replace(` ${year}`, "")} (${entry.count})`);
        link.href = `?month=${entry.month}`;
        link.dataset.month = entry.month;
        link.setAttribute("aria-current", String(entry.month === state.currentMonth));
        link.addEventListener("click", (event) => {
          event.preventDefault();
          selectMonth(entry.month, true);
        });
        item.appendChild(link);
        list.appendChild(item);
      });
      details.appendChild(list);
      els.archive.appendChild(details);
    });
  }

  function previewText(abstract) {
    const clean = abstract.replace(/\s+/g, " ").trim();
    if (clean.length <= 140) return clean;
    const clipped = clean.slice(0, 140);
    const breakAt = clipped.lastIndexOf(" ");
    return clipped.slice(0, breakAt > 90 ? breakAt : 140) + "…";
  }

  function paperNode(paper) {
    const article = element("article", "paper-entry");
    const title = element("a", "paper-title", paper.title);
    // Build this ourselves so even legacy data can never point at a PDF URL.
    title.href = `https://arxiv.org/abs/${paper.id}`;
    title.target = "_blank";
    title.rel = "noopener noreferrer";
    article.appendChild(title);

    const authors = element("div", "paper-authors");
    paper.authors.forEach((name, index) => {
      if (index) authors.appendChild(document.createTextNode(", "));
      const author = element("button", "paper-author", name);
      author.type = "button";
      author.title = `Search for ${name}`;
      author.addEventListener("click", () => {
        els.search.value = name;
        setQueryString();
        render();
        els.search.focus();
      });
      authors.appendChild(author);
    });
    article.appendChild(authors);
    article.appendChild(
      element("div", "paper-meta", `arXiv:${paper.id} · ${paper.categories.join(", ")} · ${paper.published}`)
    );

    const abstractRow = element("div", "paper-abstract-row");
    const abstract = element("p", "paper-abstract", previewText(paper.abstract));
    const toggle = element("button", "abstract-toggle", "⌄");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Show full abstract");
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      toggle.setAttribute("aria-label", expanded ? "Show full abstract" : "Collapse abstract");
      toggle.textContent = expanded ? "⌄" : "⌃";
      abstract.textContent = expanded ? previewText(paper.abstract) : paper.abstract;
    });
    abstractRow.append(abstract, toggle);
    article.appendChild(abstractRow);

    if (paper.tags && paper.tags.length) {
      article.appendChild(element("div", "paper-tags", paper.tags.join(" · ")));
    }
    return article;
  }

  function activeFilters() {
    return {
      query: normalize(els.search.value),
      from: els.from.value,
      to: els.to.value,
      author: normalize(els.author.value),
      title: normalize(els.title.value),
      topic: normalize(els.topic.value),
      category: els.category.value
    };
  }

  function matches(paper, filters) {
    const title = normalize(paper.title);
    const authors = normalize(paper.authors.join(" "));
    const abstract = normalize(paper.abstract);
    const tags = normalize((paper.tags || []).join(" "));
    const categories = paper.categories || [];
    const all = `${title} ${authors} ${abstract} ${tags} ${categories.join(" ").toLowerCase()}`;

    return (!filters.query || all.includes(filters.query)) &&
      (!filters.from || paper.published >= filters.from) &&
      (!filters.to || paper.published <= filters.to) &&
      (!filters.author || authors.includes(filters.author)) &&
      (!filters.title || title.includes(filters.title)) &&
      (!filters.topic || `${title} ${abstract} ${tags}`.includes(filters.topic)) &&
      (!filters.category || categories.includes(filters.category));
  }

  function render() {
    const filters = activeFilters();
    const papers = state.papers.filter((paper) => matches(paper, filters));
    els.feed.replaceChildren();

    if (!papers.length) {
      els.feed.appendChild(element("p", "sawyertron-empty", "No papers match these filters."));
    } else {
      const groups = new Map();
      papers.forEach((paper) => {
        if (!groups.has(paper.published)) groups.set(paper.published, []);
        groups.get(paper.published).push(paper);
      });
      groups.forEach((dayPapers, date) => {
        const section = element("section", "digest-date");
        section.appendChild(element("h2", "", dayLabel(date)));
        dayPapers.forEach((paper) => section.appendChild(paperNode(paper)));
        els.feed.appendChild(section);
      });
    }

    const updated = state.index.generated_at
      ? new Date(state.index.generated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
      : "unknown";
    els.status.textContent = `${papers.length} papers · updated ${updated}`;
  }

  function populateCategories() {
    const selected = els.category.value;
    const categories = [...new Set(state.papers.flatMap((paper) => paper.categories))].sort();
    els.category.replaceChildren(new Option("All categories", ""));
    categories.forEach((category) => els.category.appendChild(new Option(category, category)));
    els.category.value = selected;
  }

  function setQueryString() {
    const params = new URLSearchParams();
    params.set("month", state.currentMonth);
    const filters = activeFilters();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key === "query" ? "q" : key, value);
    });
    history.replaceState(null, "", `?${params.toString()}`);
  }

  async function loadFilteredRange() {
    const months = archiveMonthsBetween(els.from.value, els.to.value);
    const datasets = await Promise.all(months.map(getMonth));
    state.papers = datasets.flatMap((dataset) => dataset.papers);
    state.papers.sort((a, b) => b.published.localeCompare(a.published));
    populateCategories();
    setQueryString();
    render();
  }

  async function selectMonth(month, updateUrl) {
    state.currentMonth = month;
    const dataset = await getMonth(month);
    state.papers = dataset.papers;
    els.from.value = "";
    els.to.value = "";
    buildArchive();
    populateCategories();
    if (updateUrl) setQueryString();
    render();
  }

  function restoreFilters(params) {
    els.search.value = params.get("q") || "";
    els.from.value = params.get("from") || "";
    els.to.value = params.get("to") || "";
    els.author.value = params.get("author") || "";
    els.title.value = params.get("title") || "";
    els.topic.value = params.get("topic") || "";
  }

  async function initialize() {
    try {
      els.advanced.open = false;
      state.index = await fetchJson(shell.dataset.indexUrl);
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("month");
      state.currentMonth = state.index.months.some((entry) => entry.month === requested)
        ? requested
        : state.index.current_month;
      restoreFilters(params);
      buildArchive();
      await selectMonth(state.currentMonth, false);
      if (els.from.value || els.to.value) await loadFilteredRange();
      els.category.value = params.get("category") || "";
      render();
    } catch (error) {
      els.status.textContent = error.message;
    }
  }

  let searchTimer;
  els.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { setQueryString(); render(); }, 150);
  });
  els.apply.addEventListener("click", loadFilteredRange);
  els.clear.addEventListener("click", async () => {
    [els.search, els.from, els.to, els.author, els.title, els.topic].forEach((input) => { input.value = ""; });
    els.category.value = "";
    await selectMonth(state.currentMonth, true);
  });
  els.mobileArchive.addEventListener("change", () => selectMonth(els.mobileArchive.value, true));

  initialize();
})();
