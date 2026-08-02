/* ==========================================================================
   checklist.js — hands-on task tracking, shared by every lesson.

   Markup contract:

     <ul class="checklist" data-checklist="0001-hands-on">
       <li>
         <input type="checkbox" id="t1">
         <label for="t1">
           <span class="task">Run <code>pwd</code></span>
           <span class="expect">Expect: /home/&lt;you&gt;</span>
         </label>
       </li>
     </ul>
     <p class="checklist-progress" data-checklist-progress="0001-hands-on"></p>

   State persists in localStorage keyed by the data-checklist value, so a
   lesson reopened tomorrow remembers what was actually done. Checkbox ids
   must be unique within the page.
   ========================================================================== */

(function () {
  "use strict";

  var PREFIX = "ubuntu-cli-workspace:";

  function load(key) {
    try {
      return JSON.parse(localStorage.getItem(PREFIX + key) || "{}");
    } catch (e) {
      return {};
    }
  }

  function save(key, state) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(state));
    } catch (e) {
      /* Private mode or storage disabled — the checklist still works,
         it just won't survive a reload. Not worth interrupting for. */
    }
  }

  function wire(list) {
    var key = list.getAttribute("data-checklist");
    var state = load(key);
    var boxes = list.querySelectorAll('input[type="checkbox"]');
    var progress = document.querySelector(
      '[data-checklist-progress="' + key + '"]'
    );

    function render() {
      if (!progress) return;
      var done = 0;
      for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) done++;
      progress.textContent =
        done === boxes.length
          ? "All " + boxes.length + " done. Tell your teacher what surprised you."
          : done + " of " + boxes.length + " done.";
    }

    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      if (state[box.id]) box.checked = true;
      box.addEventListener("change", function (e) {
        state[e.currentTarget.id] = e.currentTarget.checked;
        save(key, state);
        render();
      });
    }
    render();
  }

  function init() {
    var lists = document.querySelectorAll("[data-checklist]");
    for (var i = 0; i < lists.length; i++) wire(lists[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
