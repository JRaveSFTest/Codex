# Mission: Ubuntu command line (via WSL, at work)

## Why

You use WSL on a Windows work machine and need to operate the Ubuntu shell as
confidently as you already operate PowerShell. The immediate, concrete job is to
stand up a working Linux dev environment inside WSL — VS Code connected to WSL,
Claude Code installed, and Docker running — and then live in that environment
day to day without guessing at commands.

## Success looks like

- You install and verify VS Code (WSL Remote), Claude Code, and Docker from the
  Ubuntu shell, and can diagnose it yourself when one of them doesn't start.
- You translate a PowerShell intention into the Bash equivalent without a search
  engine — and know when there is no equivalent.
- You know where a file actually lives (`/home/you` vs `/mnt/c/...`) and why that
  choice changes Docker and VS Code performance.
- You read an unfamiliar command someone (or an agent) hands you and can predict
  what it will do before you press Enter.
- `sudo`, `apt`, file permissions, pipes, and redirection feel routine rather
  than incantation.

## Constraints

- Environment is **WSL on Windows**, at work. Lessons must account for the
  Windows/Linux seam — it is where most of the surprises live.
- Starting point: comfortable with `cd` and `ls`, fluent in PowerShell, faded
  memory of a Unix shell from college. Expect false friends from PowerShell.
- Work machine: assume no admin rights on Windows unless stated, and prefer
  approaches that don't require reinstalling WSL.
- Lessons should be short — a single tangible win each.

## Out of scope

- Learning a non-Ubuntu distribution.
- Shell scripting as a craft (loops, functions, `set -euo pipefail`) until the
  environment is standing and daily fluency is real.
- Kubernetes, cloud provisioning, and CI — Docker locally is the ceiling for now.
