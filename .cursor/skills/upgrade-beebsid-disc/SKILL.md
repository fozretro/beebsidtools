---
name: upgrade-beebsid-disc
description: >-
  Keep M.MENU upgrade in lockstep with menu layout (BSMN, MENU_FORMAT,
  times table, player .menu buffer). Use when changing menu.js, upgradeSsd,
  create upgrade, M.MENU, or the SIDPLAY menu SKIP; or when asking how
  upgrade versions work.
---

# Upgrade BeebSID discs (menu path)

Any change to **on-disc menu data** must land in `upgradeMenu` in the same
change. `./create upgrade` and Test Disc Upgrade only call that function
plus a wholesale player-file replace. There is no hidden migrator.

## When the menu layout changes

Update all of these together:

| Surface | File |
|---------|------|
| Pack + inspect + upgrade | `src.create/src/lib/menu.js` (`buildMenu`, `inspectMenu`, `upgradeMenu`, `MENU_FORMAT`) |
| Disc rewrite | `src.create/src/lib/upgradeSsd.js` (usually just calls `upgradeMenu`) |
| CLI | `src.create/src/cli.js` (`create upgrade`) |
| Player buffer | `src.player` `.menu SKIP` / `MENU_BUF_SIZE` if the file can grow |
| Tests | `src.create/test/upgrade-ssd.test.js` (old layouts → current) |
| Samples | `discs/*.ssd` via `./create upgrade` (see release skill) |

`MENU_FORMAT` is the **M.MENU layout byte**, not product semver (`0.2.0`).
Bump it when the bytes after the 42-byte entries change meaning. The player
still only reads count, entries, and the seconds table; it ignores `BSMN` +
format. Older SIDPLAY keeps working if you only append after the seconds.

## How versions work (not 1→2→3)

Trailer after `N × uint16` seconds: ASCII `BSMN` then one format byte.

`inspectMenu` reports `format: null` (no trailer — Dominic-era or 0.2.0
times-only) or `1` (current).

`upgradeMenu` is **jump to latest**, not a chain of patches:

- `format > MENU_FORMAT` → throw (disc from a newer tool)
- `format === MENU_FORMAT` → no-op
- anything older (`null`, or a future `format < MENU_FORMAT` you add) →
  rebuild entries + times + `menuTrailer(MENU_FORMAT)` in one shot

A disc from several versions back (entries only, or times and no `BSMN`)
upgrades in **one** pass to current. You do **not** run format 0 then 1
then 2. If you introduce format 2, teach `upgradeMenu` to read every older
shape it still cares about and write format 2 directly. Add a test for each
old shape you intend to keep supporting.

Player / `F.HEX` / SIDPELK are **not** versioned this way. Upgrade replaces
the file when bytes differ from the assets in this tree. An ancient disc
gets today’s SIDPLAY in one replace.

## Do not

- Change `buildMenu` layout without teaching `inspectMenu` / `upgradeMenu`
- Treat product `0.x.y` as the menu format byte
- Leave convert leftovers in `discs/` (use `out/`)
