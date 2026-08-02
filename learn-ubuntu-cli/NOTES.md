# Working notes

Scratchpad for teaching preferences and observations. Not a journal — decision-grade
insights belong in `learning-records/`.

## Preferences

- _(none stated yet — ask as we go)_

## Observations

- Came to this workspace via the `teach` skill from
  [mattpocock/skills](https://github.com/mattpocock/skills). Multi-session by
  design; each session should end with the workspace updated, not just an answer
  given.
- Self-described level: "I can cd and ls." Treat that as honest rather than
  modest until evidence says otherwise — pitch Lesson 2 based on what actually
  came back from the Lesson 1 hands-on section.
- Not yet known: whether they have `sudo` rights inside WSL at work (they almost
  certainly do — WSL's default user is in `sudo`), and whether Docker Desktop is
  approved/installed on the Windows side. **Ask before the Docker lesson** — if
  Docker Desktop is blocked by IT, the lesson changes to installing the Docker
  engine directly inside Ubuntu, which is a materially different path.
- Not yet known: which Ubuntu release (`lsb_release -a`) and whether systemd is
  enabled in `/etc/wsl.conf`. Both matter for the services lesson.

## Open threads

- No community proposed yet. Ask Ubuntu and Unix & Linux Stack Exchange are
  listed in `RESOURCES.md` as read-first sources; raise actually *joining*
  something only once there is a real question to take there.
- `RESOURCES.md` has a stated gap on Docker fundamentals and on
  permissions/`sudo`. Fill before those lessons.

## Workspace layout note

The teaching workspace lives in `learn-ubuntu-cli/` rather than at the repository
root, because this repository is an unrelated VS Code extension prototype. If
this ever moves to its own repo, the workspace directory is self-contained —
relative links between lessons, assets, and reference sheets will keep working.
