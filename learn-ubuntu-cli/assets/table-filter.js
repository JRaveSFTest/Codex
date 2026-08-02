/* ==========================================================================
   table-filter.js — live filtering for reference sheets.

   Markup contract:

     <input type="search" data-table-filter="cheatsheet" placeholder="Filter…">
     <table data-filterable="cheatsheet"> … </table>

   Any number of tables may share a filter name. Rows whose text doesn't match
   are hidden; a section heading whose table has no visible rows is hidden too,
   so the page doesn't leave orphaned headings behind. Filtering is a screen
   affordance only — printing always emits the full sheet.
   ========================================================================== */

(function () {
  "use strict";

  function wire(input) {
    var name = input.getAttribute("data-table-filter");
    var tables = document.querySelectorAll('[data-filterable="' + name + '"]');

    function apply() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;

      for (var t = 0; t < tables.length; t++) {
        var table = tables[t];
        var rows = table.tBodies.length ? table.tBodies[0].rows : [];
        var visibleInTable = 0;

        for (var r = 0; r < rows.length; r++) {
          var match = !q || rows[r].textContent.toLowerCase().indexOf(q) !== -1;
          rows[r].hidden = !match;
          if (match) visibleInTable++;
        }
        shown += visibleInTable;

        // Hide the whole section (wrapper + preceding heading) when empty.
        var wrap = table.closest(".table-wrap") || table;
        wrap.hidden = visibleInTable === 0;
        var heading = wrap.previousElementSibling;
        while (heading && !/^H[2-4]$/.test(heading.tagName)) {
          heading = heading.previousElementSibling;
        }
        if (heading) heading.hidden = visibleInTable === 0;
      }

      var count = document.querySelector('[data-filter-count="' + name + '"]');
      if (count) count.textContent = q ? shown + " matching rows." : "";
    }

    input.addEventListener("input", apply);
    input.addEventListener("search", apply);
    apply();
  }

  function init() {
    var inputs = document.querySelectorAll("[data-table-filter]");
    for (var i = 0; i < inputs.length; i++) wire(inputs[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
