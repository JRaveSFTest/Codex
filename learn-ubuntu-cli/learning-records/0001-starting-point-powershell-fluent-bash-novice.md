# Starting point: PowerShell-fluent, Bash-novice, WSL at work

Prior knowledge disclosed at the outset. Fluent in PowerShell; comfortable with
`cd` and `ls` in Bash; a faded memory of a Unix shell from college that is
actively misfiring — the expectation is that remembered commands will work, and
they don't. Environment is WSL on a Windows work machine. This sets the floor:
don't re-teach "what is a shell" or basic navigation, and do treat every topic
as a *translation* problem from a known model rather than a blank slate.

## Implications

- **Lead with contrast, not with basics.** The fastest path to fluency is
  mapping an existing PowerShell intention onto Bash spelling. Hence the
  PowerShell → Bash reference sheet as the first reference document.
- **The Windows/Linux seam is not an advanced topic here — it is the ground.**
  Every lesson should assume `/mnt/c` exists and may be the source of the
  confusion.
- **Expect object-vs-text to be the deep misconception.** PowerShell pipes
  objects with properties; Bash pipes bytes. This has not yet been tested and
  is the most likely source of future stumbling. Watch for it when pipes and
  `grep`/`awk` come up, and write a record when it lands.
- **Mission is concrete and near-term:** VS Code (WSL Remote), Claude Code, and
  Docker running inside WSL. Lessons should each move that forward, so
  `apt`/`sudo` comes next, then permissions, then Docker.
