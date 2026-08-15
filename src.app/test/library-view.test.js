import { test } from "node:test";
import assert from "node:assert/strict";
import {
  breadcrumbParts,
  compareRows,
  defaultExpanded,
  filterTunes,
  matchesQuery,
  parentPath,
  visibleRows,
} from "../src/hvsc/libraryView.js";

const TUNES = [
  {
    path: "GAMES/C-D/Commando.sid",
    name: "Commando.sid",
    title: "Commando",
    author: "Rob Hubbard",
    release: "1985 Elite",
  },
  {
    path: "GAMES/B-C/Bionic_Commando.sid",
    name: "Bionic_Commando.sid",
    title: "Bionic Commando",
    author: "Tim Follin",
    release: "1988 GO!/Capcom",
  },
  {
    path: "MUSICIANS/H/Hubbard_Rob/After_8.sid",
    name: "After_8.sid",
    title: "After 8",
    author: "Rob Hubbard",
    release: "1985",
  },
];

test("parentPath strips the file name", () => {
  assert.equal(parentPath("GAMES/C-D/Commando.sid"), "GAMES/C-D");
  assert.equal(parentPath("Commando.sid"), "");
});

test("breadcrumb starts at the HVSC root", () => {
  const crumbs = breadcrumbParts("C64Music", "MUSICIANS/H");
  assert.deepEqual(
    crumbs.map((c) => c.name),
    ["C64Music", "MUSICIANS", "H"],
  );
  assert.equal(crumbs[0].path, "");
  assert.equal(crumbs[2].path, "MUSICIANS/H");
});

test("search field Title matches Commando covers", () => {
  const hits = filterTunes(TUNES, { query: "Commando", field: "title" });
  assert.equal(hits.length, 2);
  assert.ok(hits.every((t) => /commando/i.test(t.title)));
});

test("search field Author is Rob Hubbard only", () => {
  const hits = filterTunes(TUNES, { query: "Hubbard", field: "author" });
  assert.equal(hits.length, 2);
  assert.ok(hits.every((t) => /Hubbard/.test(t.author)));
});

test("filename search does not use the title", () => {
  assert.equal(matchesQuery(TUNES[0], "Elite", "filename"), false);
  assert.equal(matchesQuery(TUNES[0], "Commando.sid", "filename"), true);
});

test("current-folder scope stays under GAMES", () => {
  const hits = filterTunes(TUNES, { query: "Hubbard", field: "author", folder: "GAMES" });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].title, "Commando");
});

test("browse tree shows top-level folders by default", () => {
  const expanded = defaultExpanded(TUNES);
  assert.ok(expanded.has("GAMES"));
  assert.ok(expanded.has("MUSICIANS"));
  const rows = visibleRows(TUNES, expanded);
  const names = rows.filter((r) => r.kind === "folder").map((r) => r.name);
  assert.ok(names.includes("GAMES"));
  assert.ok(names.includes("C-D"));
  assert.ok(!names.includes("Hubbard_Rob"));
});

test("expanding a leaf folder lists its SIDs", () => {
  const expanded = new Set(["GAMES", "GAMES/C-D"]);
  const rows = visibleRows(TUNES, expanded);
  const commando = rows.find((r) => r.kind === "tune" && r.title === "Commando");
  assert.ok(commando);
  assert.equal(commando.depth, 2);
});

test("a search query flattens to matching tunes", () => {
  const rows = visibleRows(TUNES, new Set(), { query: "Commando", field: "title" });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.kind === "tune" && r.depth === 0));
});

test("sort by author", () => {
  const rows = [
    { kind: "tune", title: "Z", author: "Rob Hubbard" },
    { kind: "tune", title: "A", author: "Tim Follin" },
  ];
  rows.sort((a, b) => compareRows(a, b, "author", "asc"));
  assert.equal(rows[0].author, "Rob Hubbard");
});
