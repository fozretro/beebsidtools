---
name: release-beebsidtools
description: >-
  Cut a lockstep BeebSID Tools release (notes, version bump, sample discs,
  Gallery shots, PR into main, GitHub tag, Pages). Use when the user asks
  to release, publish, cut a version, stamp a version, write release notes,
  run sync-versions or publish-release, recapture gallery screenshots for a
  release, or what to do with a version branch such as 0.2.0.
---

# Release BeebSID Tools

One semver for the whole product. Root `package.json` is the source of truth.
Do not version `src.create` / `src.player` / `src.app` by hand.

Stay on `0.x` until a disc from this tree is the compatibility promise; then
`1.0.0`. Help and the header show `BeebSID Tools vX.Y.Z`, not three component
versions.

Only push, merge, or publish when the user asked to cut or ship the release.

## Data flow

```text
releases/X.Y.Z.md  +  root package.json version
        │
        ▼
npm run sync-versions  →  three package.json version fields
        │
        ▼
commit on feature branch  →  PR  →  merge main
        │
        ├─ Pages workflow (push to main)
        └─ npm run publish-release  →  gh release create vX.Y.Z
```

| Artifact | Who writes it | Who reads it |
|----------|---------------|--------------|
| `releases/X.Y.Z.md` | You (hand) | GitHub Release body; Disc Creator Help (f0) via `src.app/src/releaseNotes.js` |
| Root `package.json` `version` | You (hand) | `sync-versions`; `src.app/src/versions.js` → `TOOLS_VERSION` |
| `src.create` / `src.player` / `src.app` `package.json` versions | `scripts/sync-versions.js` | `publish-release` equality check |
| Git tag `vX.Y.Z` | `scripts/publish-release.js` (`gh release create`) | GitHub Releases |
| Pages site | `.github/workflows/pages.yml` on **push to `main`** | https://fozretro.github.io/beebsidtools/ |

`publish-release` does **not** bump, commit, or push. It fails if the three
packages disagree with root, or if `releases/<version>.md` is missing.

## Notes file

Write `releases/X.Y.Z.md` (same text for GitHub and Help). Help strips `#`
headings and `**`. Vite globs `../../releases/*.md` from the app; a missing
file means that version is absent from Help.

These notes are **what the user gets in this version**, not a changelog of
commits and not a technical design dump.

### Before drafting

1. Diff this branch against the previous release (`releases/*.md` +
   `origin/main`). List candidate features.
2. Drop anything not finished enough to ship in the notes (a patch that is
   not 100%, a player that did not get the feature, etc.).
3. Drop anything the previous release already promised (shared CLI/app pack
   path, “needs BeebSID hardware”, first-run bootstrap, …) unless it *changed*.
4. Ask of each remaining line: **what does the user do or see?** If the
   answer is a flag, hash, address, chip, buffer, or “so the UI stays
   responsive”, cut it.

### Shape

Opening paragraph, then only the sections that have something **new**:

`## Create` / `## Player` / `## Disc Creator` / `## Notes`

Omit an empty section. Do not keep `## Create` just because 0.1.0 had it.

Put a behavior in the section where the user meets it. Auto-play length
belongs under Player (and a short Notes caveat if needed), not Create,
even if create packs the seconds.

### Do not put in the notes

- Implementation details (search stops preview to keep the list snappy;
  Timer1; Vite vs `dist`; file formats; `--flag=` names)
- Unfinished work
- Standing product facts that did not change
- “Same `.ssd` from website or CLI” unless that contract is new

Show the draft and wait before the version bump.

## Sample discs and Gallery

Test Disc **Gallery** does not read `discs/` live. It fetches
`src.app/public/gallery/` (gitignored), which `sync:gallery` copies from
`discs/*.ssd` + `discs/*.png`. `./app` syncs once at start (`predev`).
A later `create upgrade` leaves that copy and the PNG thumbs on the old
SIDPLAY — including the on-screen `X.Y.Z`.

Do this **after** the version bump and player rebuild (SIDPLAY embeds the
root version). Never upgrade or recapture before the bump, or the samples
still say the previous release.

```text
root package.json version
        │
        ▼
npm run build:player          → sidpl.o / sidpelk.o (version.asm)
        │
        ▼
./create upgrade discs/*.ssd  → sample SSDs carry this SIDPLAY
        │
        ├─ npm run capture:gallery --prefix src.app -- --force
        │     → discs/<stem>.png (menu shot, version visible)
        └─ npm run sync --prefix src.app
              → public/player/ + public/gallery/
```

```bash
for f in discs/*.ssd; do ./create upgrade "$f"; done
npm run capture:gallery --prefix src.app -- --force
npm run sync --prefix src.app
```

`--force` is required: capture skips a stem when `discs/<stem>.png`
already exists. Convert leftovers belong in `out/`, never next to these
`.ssd` files. “already current” on every disc is fine — still run the
loop. Commit `discs/*.ssd` and `discs/*.png` that changed. `public/gallery/`
is generated; Pages gets it from `sync` on the app build.

## End-to-end (including git)

Work from the repo root. `X.Y.Z` is the version being cut (e.g. `0.2.0`).

1. **Finish the work** on the feature / version branch. Run `npm test` or
   `npm run test:fast` if anything landed that is not already green.
2. **Notes** — draft `releases/X.Y.Z.md` with the rules above; stop for
   review before bumping.
3. **Bump** — set root `package.json` `"version"` to `X.Y.Z`.
4. **Sync versions** — `npm run sync-versions` (must reprint all three
   targets).
5. **Rebuild player** — `npm run build:player` so `version.asm` is `X.Y.Z`.
   Then `npm run update:golden-player`. If pack bytes change,
   `npm run update:golden-ssd`.
6. **Samples + Gallery** — upgrade `discs/`, recapture menu shots, sync
   the app (commands in **Sample discs and Gallery**). Spot-check one
   Gallery thumb and one booted disc for `X.Y.Z`.
7. **Commit** on the current branch (notes, four `package.json` files,
   player goldens, `discs/*.ssd`, `discs/*.png`). Message like
   `Release X.Y.Z.` — why, not a file list.
8. **Push the branch** — `git push -u origin HEAD` if untracked, else
   `git push`.
9. **PR into `main`** — `gh pr create` (title + why). Do not target the
   version branch as the base.
10. **Merge** when CI is green and the user wants it shipped
    (`gh pr merge` or GitHub UI).
11. **Update local `main`** — `git checkout main && git pull`.
12. **Publish** — on that `main` commit, `npm run publish-release`
    (`gh release create vX.Y.Z --title "BeebSID Tools X.Y.Z" --notes-file
    releases/X.Y.Z.md`).
13. **Pages** — the merge already queued the workflow. Confirm Actions if
    asked. No extra deploy command.
14. **Delete the feature branch** if the user wants it gone.

Bumping after merge is fine: do steps 2–7 on `main` after step 11, push,
then publish. Same end state. Do **not** run `publish-release` from an
unmerged branch — the tag would exist while Pages still served the
previous `main`.

## Branch named like the version

A branch `0.2.0` (or similar) is next-release work, not a stand-in for
`main`. Pages and the public site only move when `main` moves. Merge it,
then tag from the commit that actually landed on `main`.

## Do not

- Version create / player / app independently
- Edit the three package versions without `sync-versions`
- Amend or force-push `main`
- Skip hooks (`--no-verify`)
- Publish before the version commit is on `origin/main`
- Jump to `1.0.0` because the number feels ready
- Ship a player or menu-format change without upgrading `discs/*.ssd`
- Stamp a version without recapturing `discs/*.png` and syncing Gallery
  (`public/gallery/` will still boot and show the previous SIDPLAY)

## More context

- Policy: `../rules/versioning.mdc`
- Human summary: [`CONTRIBUTING.md`](../../CONTRIBUTING.md) (Releases)
- Scripts: `scripts/sync-versions.js`, `scripts/publish-release.js`
- Help wiring: `src.app/src/releaseNotes.js`, `src.app/src/versions.js`
- Menu / `create upgrade` lockstep: `../upgrade-beebsid-disc/SKILL.md`
- Tests / goldens: `../test-beebsidtools/SKILL.md`
- Gallery copy / capture: `src.app/scripts/sync-gallery.js`,
  `src.app/scripts/capture-gallery-shots.js`
