# Learning the Ubuntu command line

A teaching workspace, built with the [`teach`](https://github.com/mattpocock/skills)
skill. It is stateful: it grows over multiple sessions, and the files here are
the memory between them.

## Start here

No setup required — these are hosted, and private to you:

- **[Lesson 1 · Where am I, and where do commands come from?](https://claude.ai/code/artifact/52d566be-54a7-40a0-801b-92aeb57dfec7)**
- **[Reference · PowerShell → Bash](https://claude.ai/code/artifact/591efc0b-3936-4e03-9ead-819046d51ea3)**

### If you'd rather have the files locally

You need `git clone` first — `git pull` only works inside a repository you
already have. From your Ubuntu terminal:

```bash
mkdir -p ~/code && cd ~/code
git clone -b claude/ubuntu-command-line-tutorial-k2glm5 https://github.com/JRaveSFTest/Codex.git
cd Codex/learn-ubuntu-cli
explorer.exe lessons/0001-where-am-i-and-where-do-commands-come-from.html
```

That last line hands the file to Windows, which opens it in your default
browser — itself a small demonstration of Lesson 1. Note the deliberate
`~/code`: the Linux filesystem, not `/mnt/c`.

## What's here

| Path | What it is |
| --- | --- |
| [`MISSION.md`](MISSION.md) | Why you're learning this. Every lesson traces back to it. |
| [`lessons/`](lessons/) | The lessons. Short, self-contained, numbered. Do them in order. |
| [`reference/`](reference/) | Cheat sheets to keep open while you work. Built to print. |
| [`RESOURCES.md`](RESOURCES.md) | Vetted external sources. Lessons cite these rather than guessing. |
| [`GLOSSARY.md`](GLOSSARY.md) | Terms, added once you can use them correctly. |
| [`learning-records/`](learning-records/) | What you know so far, and what that implies for what to teach next. |
| [`assets/`](assets/) | Shared stylesheet and interactive components. |
| [`scripts/`](scripts/) | `build-standalone.mjs` flattens a lesson into one self-contained file for hosting. Output lands in `dist/` — generated, never hand-edited. |
| [`NOTES.md`](NOTES.md) | Teaching preferences and open questions. |

## How to use it

1. Read the lesson. It's short by design — working memory is the constraint.
2. **Actually run the hands-on section** in your real WSL terminal. The
   checkboxes remember what you've done.
3. Take the quiz from memory. Getting one wrong teaches more than getting it
   right by scrolling back up.
4. Come back and tell me what surprised you, or paste terminal output that
   didn't match. That's what sets the level of the next lesson.

Ask questions freely — the lessons are the curriculum, but I'm the teacher.
