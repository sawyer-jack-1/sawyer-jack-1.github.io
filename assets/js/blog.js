(function () {
  "use strict";

  const shell = document.querySelector(".blog-shell");
  if (!shell) return;

  const els = {
    form: shell.querySelector(".blog-search"),
    search: document.getElementById("blog-search"),
    advanced: document.getElementById("blog-advanced"),
    from: document.getElementById("blog-filter-from"),
    to: document.getElementById("blog-filter-to"),
    title: document.getElementById("blog-filter-title"),
    text: document.getElementById("blog-filter-text"),
    clear: document.getElementById("blog-clear-filters"),
    filterStatus: document.getElementById("blog-filter-status"),
    status: document.getElementById("blog-status"),
    archive: shell.querySelector(".blog-archive"),
    index: document.getElementById("blog-post-index"),
    results: document.getElementById("blog-search-results"),
    resultsList: document.getElementById("blog-results-list"),
    reader: document.getElementById("blog-reader"),
    empty: document.getElementById("blog-empty")
  };

  const normalize = (value) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const posts = Array.from(shell.querySelectorAll(".blog-post-template"), (template) => ({
    id: template.dataset.postId,
    date: template.dataset.date,
    displayTitle: template.dataset.title,
    title: normalize(template.dataset.title),
    text: normalize(template.content.querySelector(".blog-post-body").textContent),
    url: template.content.querySelector(".blog-post-title a").getAttribute("href"),
    template
  })).sort((a, b) => b.date.localeCompare(a.date));
  if (!posts.length) return;

  const viewTemplates = Array.from(shell.querySelectorAll(".blog-view-template"));
  const viewForPath = () => viewTemplates.find((template) => template.dataset.url === window.location.pathname);
  const latestCount = els.index.querySelectorAll(".blog-post-item").length;
  const mobile = window.matchMedia("(max-width: 700px)");
  const state = {
    view: "post",
    selected: posts[0].id,
    query: "",
    filters: { from: "", to: "", title: "", text: "" }
  };
  let renderVersion = 0;
  let mathQueue = Promise.resolve();

  function hasAdvancedFilters() {
    return Object.values(state.filters).some(Boolean);
  }

  function readLocation() {
    const params = new URLSearchParams(window.location.search);
    els.search.value = params.get("q") || "";
    els.from.value = params.get("from") || "";
    els.to.value = params.get("to") || "";
    els.title.value = params.get("title") || "";
    els.text.value = params.get("text") || "";
    els.to.setCustomValidity("");
    state.query = normalize(els.search.value);
    state.filters = {
      from: els.from.value, to: els.to.value,
      title: normalize(els.title.value), text: normalize(els.text.value)
    };
    state.selected = params.get("post");
    state.view = state.selected || state.query || hasAdvancedFilters()
      ? "post" : (viewForPath()?.dataset.view || "post");
    els.advanced.open = hasAdvancedFilters();
  }

  function writeLocation(push) {
    const url = new URL(window.location.href);
    const viewTemplate = viewTemplates.find((template) => template.dataset.view === state.view);
    url.pathname = viewTemplate ? viewTemplate.dataset.url : shell.dataset.blogUrl;
    url.hash = "";
    ["post", "q", "from", "to", "title", "text"].forEach((key) => url.searchParams.delete(key));
    if (state.view === "post" && state.selected && (state.selected !== posts[0].id || state.query || hasAdvancedFilters())) {
      url.searchParams.set("post", state.selected);
    }
    if (state.query) url.searchParams.set("q", els.search.value.trim());
    Object.entries(state.filters).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    if (url.href === window.location.href) return;
    history[push ? "pushState" : "replaceState"](null, "", url.pathname + url.search + url.hash);
  }

  function matches(post) {
    const filters = state.filters;
    return (!state.query || `${post.title} ${post.text}`.includes(state.query)) &&
      (!filters.from || post.date >= filters.from) &&
      (!filters.to || post.date <= filters.to) &&
      (!filters.title || post.title.includes(filters.title)) &&
      (!filters.text || post.text.includes(filters.text));
  }

  function focusReader() {
    const heading = els.reader.querySelector(".blog-post-title, .blog-view-title");
    if (!heading) return;
    heading.focus({ preventScroll: true });
    els.reader.scrollIntoView({ block: "start" });
  }

  function showContent(template, focus) {
    const version = ++renderVersion;
    if (!template) {
      els.reader.hidden = true;
      els.reader.removeAttribute("aria-busy");
      return;
    }
    els.reader.hidden = false;
    const contentKey = template.dataset.postId || template.dataset.view;
    if (els.reader.dataset.contentKey === contentKey) {
      els.reader.removeAttribute("aria-busy");
      if (focus) focusReader();
      return;
    }

    // Serialize swaps with MathJax so a fast selection cannot typeset a discarded article.
    els.reader.setAttribute("aria-busy", "true");
    mathQueue = mathQueue.catch(() => {}).then(async () => {
      const math = window.MathJax;
      if (math && math.startup) await math.startup.promise.catch(() => {});
      if (version !== renderVersion) return;
      if (math && math.typesetClear) math.typesetClear([els.reader]);
      els.reader.replaceChildren(template.content.cloneNode(true));
      els.reader.dataset.contentKey = contentKey;
      if (focus) focusReader();
      if (math && math.typesetPromise) {
        try {
          await math.typesetPromise([els.reader]);
        } catch (error) {
          console.warn("Blog equations could not be typeset.", error);
        }
      }
      if (version === renderVersion) els.reader.removeAttribute("aria-busy");
    });
  }

  function render(focus = false, preserveSelection = false) {
    const visible = posts.filter(matches);
    const ids = new Set(visible.map((post) => post.id));
    const knownSelection = posts.some((post) => post.id === state.selected);
    if (state.view !== "post") {
      state.selected = null;
    } else if (!knownSelection || (!preserveSelection && !ids.has(state.selected))) {
      state.selected = visible.length ? visible[0].id : null;
    }
    const selected = posts.find((post) => post.id === state.selected);
    const filtered = Boolean(state.query || hasAdvancedFilters());

    els.resultsList.replaceChildren();
    els.results.hidden = !filtered || !visible.length;
    if (filtered) visible.forEach((post) => {
      const item = document.createElement("li");
      item.className = "blog-post-item";
      const date = document.createElement("time");
      date.className = "blog-index-date";
      date.dateTime = post.date;
      date.textContent = post.template.content.querySelector(".blog-post-date").textContent;
      const link = document.createElement("a");
      link.className = "blog-index-link";
      link.href = post.url;
      link.dataset.postId = post.id;
      link.textContent = post.displayTitle;
      item.append(date, link);
      els.resultsList.appendChild(item);
    });

    shell.querySelectorAll(".blog-index-link").forEach((link) => {
      if (link.dataset.postId === state.selected) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    els.index.querySelector(".blog-archive-link").toggleAttribute("aria-current", state.view === "archive");
    if (state.view === "archive") els.index.querySelector(".blog-archive-link").setAttribute("aria-current", "page");

    els.status.textContent = filtered
      ? `${visible.length} of ${posts.length} posts found · Newest first`
      : `${latestCount} latest posts · Newest first`;
    els.filterStatus.textContent = hasAdvancedFilters() ? "· Filters active" : "";
    els.empty.hidden = !filtered || visible.length > 0;
    const viewTemplate = viewTemplates.find((template) => template.dataset.view === state.view);
    showContent(viewTemplate || selected?.template, focus);
  }

  shell.addEventListener("click", (event) => {
    const link = event.target.closest(".blog-index-link, [data-blog-view]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    state.view = link.dataset.blogView || "post";
    state.selected = link.dataset.postId || null;
    if (state.view !== "post") clearFilters();
    if (mobile.matches) els.archive.open = false;
    render(true, true);
    writeLocation(true);
  });

  els.search.addEventListener("input", () => {
    state.view = "post";
    state.query = normalize(els.search.value);
    render();
    writeLocation(false);
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (els.from.value && els.to.value && els.from.value > els.to.value) {
      els.to.setCustomValidity("Choose an end date on or after the start date.");
      els.to.reportValidity();
      return;
    }
    els.to.setCustomValidity("");
    state.view = "post";
    state.query = normalize(els.search.value);
    state.filters = {
      from: els.from.value, to: els.to.value,
      title: normalize(els.title.value), text: normalize(els.text.value)
    };
    render();
    writeLocation(false);
  });
  [els.from, els.to].forEach((input) => {
    input.addEventListener("input", () => els.to.setCustomValidity(""));
  });

  function clearFilters() {
    [els.search, els.from, els.to, els.title, els.text].forEach((input) => { input.value = ""; });
    els.to.setCustomValidity("");
    state.query = "";
    state.filters = { from: "", to: "", title: "", text: "" };
  }

  els.clear.addEventListener("click", () => {
    clearFilters();
    render();
    writeLocation(false);
    els.search.focus();
  });

  window.addEventListener("popstate", () => {
    readLocation();
    render(false, true);
  });
  mobile.addEventListener("change", () => { els.archive.open = !mobile.matches; });

  readLocation();
  render(false, true);
  els.archive.open = !mobile.matches;
  els.form.hidden = false;
}());
