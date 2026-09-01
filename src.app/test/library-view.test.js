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
  // Given a tune path
  // When parentPath runs
  // Then the file name is removed
  assert.equal(parentPath("GAMES/C-D/Commando.sid"), "GAMES/C-D");
  assert.equal(parentPath("Commando.sid"), "");
});

test("breadcrumb starts at the HVSC root", () => {
  // Given the collection name and a folder path
  // When breadcrumbParts splits it
  const crumbs = breadcrumbParts("C64Music", "MUSICIANS/H");
  // Then the first crumb is the root and the last is MUSICIANS/H

  assert.deepEqual(
    crumbs.map((c) => c.name),
    ["C64Music", "MUSICIANS", "H"],
  );
  assert.equal(crumbs[0].path, "");
  assert.equal(crumbs[2].path, "MUSICIANS/H");
});

test("search field Title matches Commando covers", () => {
  // Given the sample library
  // When filterTunes searches titles for Commando
  const hits = filterTunes(TUNES, { query: "Commando", field: "title" });
  // Then both Commando titles match

  assert.equal(hits.length, 2);
  assert.ok(hits.every((t) => /commando/i.test(t.title)));
});

test("search field Author is Rob Hubbard only", () => {
  // Given the sample library
  // When filterTunes searches authors for Hubbard
  const hits = filterTunes(TUNES, { query: "Hubbard", field: "author" });
  // Then only Rob Hubbard tunes match

  assert.equal(hits.length, 2);
  assert.ok(hits.every((t) => /Hubbard/.test(t.author)));
});

test("filename search does not use the title", () => {
  // Given Commando.sid
  // When matchesQuery uses the filename field
  // Then Elite (from the release) does not match
  assert.equal(matchesQuery(TUNES[0], "Elite", "filename"), false);
  assert.equal(matchesQuery(TUNES[0], "Commando.sid", "filename"), true);
});

test("current-folder scope stays under GAMES", () => {
  // Given the sample library scoped to GAMES
  // When filterTunes searches authors for Hubbard
  const hits = filterTunes(TUNES, { query: "Hubbard", field: "author", folder: "GAMES" });
  // Then only Commando in GAMES matches

  assert.equal(hits.length, 1);
  assert.equal(hits[0].title, "Commando");
});

test("browse tree shows top-level folders by default", () => {
  // Given the sample library
  // When defaultExpanded and visibleRows build the tree
  const expanded = defaultExpanded(TUNES);
  assert.ok(expanded.has("GAMES"));
  assert.ok(expanded.has("MUSICIANS"));
  const rows = visibleRows(TUNES, expanded);
  // Then GAMES and C-D are visible and Hubbard_Rob is not
  const names = rows.filter((r) => r.kind === "folder").map((r) => r.name);
  assert.ok(names.includes("GAMES"));
  assert.ok(names.includes("C-D"));
  assert.ok(!names.includes("Hubbard_Rob"));
});

test("expanding a leaf folder lists its SIDs", () => {
  // Given GAMES/C-D expanded
  const expanded = new Set(["GAMES", "GAMES/C-D"]);
  // When visibleRows lists the tree
  const rows = visibleRows(TUNES, expanded);
  // Then Commando is a tune two folders deep

  const commando = rows.find((r) => r.kind === "tune" && r.title === "Commando");
  assert.ok(commando);
  assert.equal(commando.depth, 2);
});

test("a search query flattens to matching tunes", () => {
  // Given a title search for Commando
  // When visibleRows runs
  const rows = visibleRows(TUNES, new Set(), { query: "Commando", field: "title" });
  // Then only matching tunes appear at depth 0

  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.kind === "tune" && r.depth === 0));
});

test("sort by author", () => {
  // Given two tune rows
  const rows = [
    { kind: "tune", title: "Z", author: "Rob Hubbard" },
    { kind: "tune", title: "A", author: "Tim Follin" },
  ];
  // When they are sorted by author
  rows.sort((a, b) => compareRows(a, b, "author", "asc"));
  // Then Rob Hubbard is first
  assert.equal(rows[0].author, "Rob Hubbard");
});
