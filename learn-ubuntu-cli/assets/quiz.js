/* ==========================================================================
   quiz.js — retrieval-practice component shared by every lesson.

   Markup contract:

     <div class="quiz" data-quiz>
       <p class="quiz-q">Question text</p>
       <ul class="quiz-options">
         <li><button data-correct data-why="Why this is right">Answer</button></li>
         <li><button data-why="Why this is wrong">Answer</button></li>
       </ul>
       <p class="quiz-feedback" hidden></p>
     </div>

   Optionally add <p class="quiz-score" data-quiz-score></p> anywhere on the
   page to get a running tally.

   Behaviour: one attempt per question, immediate feedback, every option's
   rationale revealed after answering. Answers are shuffled on load so the
   position of the correct answer carries no information across re-reads.
   ========================================================================== */

(function () {
  "use strict";

  var answered = 0;
  var correct = 0;

  function shuffle(list) {
    // Fisher-Yates. Order only affects presentation, so Math.random is fine.
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function updateScore() {
    var total = document.querySelectorAll("[data-quiz]").length;
    var nodes = document.querySelectorAll("[data-quiz-score]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent =
        answered === 0
          ? ""
          : correct + " of " + answered + " answered correctly (" + total + " questions in this set).";
    }
  }

  function wire(quiz) {
    var list = quiz.querySelector(".quiz-options");
    var feedback = quiz.querySelector(".quiz-feedback");
    if (!list) return;

    var items = Array.prototype.slice.call(list.children);
    shuffle(items).forEach(function (li) {
      list.appendChild(li);
    });

    var buttons = quiz.querySelectorAll(".quiz-options button");

    function reveal(chosen) {
      var isRight = chosen.hasAttribute("data-correct");
      answered++;
      if (isRight) correct++;

      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        b.disabled = true;
        if (b.hasAttribute("data-correct")) b.classList.add("is-right");
        else if (b === chosen) b.classList.add("is-wrong");
      }

      if (feedback) {
        var right = quiz.querySelector(".quiz-options button[data-correct]");
        var lead = isRight ? "Correct. " : "Not quite. ";
        var why = isRight
          ? chosen.getAttribute("data-why") || ""
          : (chosen.getAttribute("data-why") || "") +
            " The answer is “" +
            (right ? right.textContent.trim() : "") +
            "” — " +
            (right ? right.getAttribute("data-why") || "" : "");
        feedback.textContent = lead + why;
        feedback.hidden = false;
      }
      updateScore();
    }

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (e) {
        reveal(e.currentTarget);
      });
    }
  }

  function init() {
    var quizzes = document.querySelectorAll("[data-quiz]");
    for (var i = 0; i < quizzes.length; i++) wire(quizzes[i]);
    updateScore();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
