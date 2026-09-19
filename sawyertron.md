---
layout: default
title: SawyerTRON
---

<div class="sawyertron-shell" data-index-url="{{ '/assets/sawyertron/data/index.json' | relative_url }}">
  <aside class="sawyertron-archive" aria-label="Archive">
    <h2>Archive</h2>
    <div id="archive-list"></div>
  </aside>

  <main class="sawyertron-main">
    <h1>SawyerTRON</h1>
    <div class="sawyertron-subtitle">An arXiv digest, updated daily.</div>

    <div class="sawyertron-search-row">
      <input id="paper-search" type="search" placeholder="Search titles, authors, abstracts…" aria-label="Search papers">
    </div>

    <details class="advanced-search" id="advanced-search">
      <summary>Advanced search</summary>
      <div class="advanced-search-grid">
        <label>From <input id="filter-from" type="date"></label>
        <label>To <input id="filter-to" type="date"></label>
        <label>Author <input id="filter-author" type="search"></label>
        <label>Title contains <input id="filter-title" type="search"></label>
        <label>Topic or abstract contains <input id="filter-topic" type="search"></label>
        <label>arXiv category <select id="filter-category"><option value="">All categories</option></select></label>
        <div class="advanced-search-actions">
          <button class="text-button" id="apply-filters" type="button">Apply</button>
          <button class="text-button" id="clear-filters" type="button">Clear</button>
        </div>
      </div>
    </details>

    <label class="mobile-archive">Archive
      <select id="mobile-archive-select" aria-label="Choose archive month"></select>
    </label>

    <div class="sawyertron-status" id="sawyertron-status" aria-live="polite">Loading papers…</div>
    <div id="paper-feed"></div>
  </main>
</div>

<script src="{{ '/assets/js/sawyertron.js' | relative_url }}" defer></script>
