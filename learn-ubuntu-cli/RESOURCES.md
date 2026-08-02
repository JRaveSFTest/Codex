# Ubuntu Command Line (WSL) Resources

Curated, high-trust sources for this workspace. Knowledge in lessons is drawn
from here, not from guesses. Every entry is annotated with when to reach for it.

## Knowledge

### The shell itself

- [Book: _The Linux Command Line_ — William Shotts (free PDF, 5th internet edition)](https://linuxcommand.org/tlcl.php)
  The standard beginner-to-competent text, ~550 pages, Creative Commons.
  Use for: any foundational topic — navigation, permissions, redirection,
  processes, text processing. Read a chapter, don't read it cover to cover.

- [Tutorial: "The Linux command line for beginners" — Ubuntu](https://ubuntu.com/tutorials/command-line-for-beginners)
  Ubuntu's own hands-on intro. Covers `pwd`/`cd`/`ls`, file operations, pipes,
  `sudo`, `man`. Use for: a fast first pass on a topic, with Ubuntu-correct
  details.

- [Course: The Missing Semester of Your CS Education — MIT](https://missing.csail.mit.edu/)
  Lecture 1 (the shell) and the command-line-environment lecture. Use for:
  the *why* behind shell design, plus job control and dotfiles later.

- [Reference: GNU Bash Reference Manual](https://www.gnu.org/software/bash/manual/bash.html)
  The authoritative spec for Bash behaviour. Use for: settling arguments about
  quoting, expansion, and [command lookup order](https://www.gnu.org/software/bash/manual/bash.html#Command-Search-and-Execution).
  Dense — reach for it to confirm, not to learn.

- [Ubuntu Manpages](https://manpages.ubuntu.com/)
  The same `man` pages on your machine, in a browser. Use for: looking up flags
  when you're reading a command someone handed you.

- [explainshell.com](https://explainshell.com/)
  Paste a whole command line; it breaks it into per-flag man-page excerpts.
  Use for: decoding an unfamiliar one-liner before running it — including ones
  an AI agent proposes.

### The Windows/Linux seam (WSL)

- [WSL documentation — Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/)
  Use for: anything about how WSL itself behaves.

- [Working across file systems — Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/filesystems)
  Documents that Windows drives mount under `/mnt/`, that Linux files are
  reachable from Windows via `\\wsl$`, that Linux is case-sensitive while
  Windows is not, and that Windows executables run from Bash as `notepad.exe`.
  Use for: every "why does this path behave strangely" question.

- [Basic commands for WSL — Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/basic-commands)
  The `wsl.exe` command surface (`wsl --list`, `wsl --shutdown`, etc.), which is
  run from PowerShell, not from inside Ubuntu. Use for: managing the distro
  rather than working inside it.

- [Set up a WSL development environment — Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/setup/environment)
  Microsoft's opinionated setup path, including VS Code Remote. Use for:
  the environment-standing half of the mission.

### The tools being installed

- [Docker Desktop WSL 2 backend — Docker Docs](https://docs.docker.com/desktop/features/wsl/)
  and [WSL 2 best practices](https://docs.docker.com/desktop/features/wsl/best-practices/)
  Use for: Docker setup, and the load-bearing performance rule — keep
  bind-mounted source inside the Linux filesystem, not under `/mnt/c`, or you
  lose both speed and `inotify` file-change events.

- [Claude Code — Advanced setup](https://code.claude.com/docs/en/setup)
  Documents the WSL install path (`curl -fsSL https://claude.ai/install.sh | bash`),
  the apt repository option, and `claude doctor` for diagnostics.
  Use for: installing and verifying Claude Code inside Ubuntu, not from
  PowerShell.

## Wisdom (Communities)

- [Ask Ubuntu](https://askubuntu.com/)
  Ubuntu-specific Q&A, heavily moderated. Use for: "how do I do X on Ubuntu"
  where the answer is version-specific. Search before asking — most beginner
  questions are already answered well.

- [Unix & Linux Stack Exchange](https://unix.stackexchange.com/)
  Deeper, more general, sharper answers than Ask Ubuntu. Use for: shell
  semantics, permissions, process questions.

- [microsoft/WSL on GitHub](https://github.com/microsoft/WSL)
  The issue tracker is the real source of truth for WSL bugs and workarounds.
  Use for: "is this broken for everyone or just me?"

- [Ubuntu Discourse](https://discourse.ubuntu.com/)
  Official community forums. Use for: longer-form discussion and announcements.

## Gaps

- No vetted resource yet for **Docker fundamentals** (images vs containers vs
  volumes) as opposed to Docker-on-WSL plumbing. Find one before the Docker
  lessons.
- No vetted resource yet for **file permissions and `sudo`** beyond the Shotts
  chapter. Worth finding something WSL-aware, since WSL's default user and
  `/mnt/c` permissions behave unusually.
- Community preference not yet stated. Nothing has been proposed for joining —
  the sources above are all read-only so far.
