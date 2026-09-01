import { test } from "node:test";
import assert from "node:assert/strict";
import { galleryTitle, parseGalleryIndex } from "../src/gallery.js";

test("galleryTitle humanizes disc stems", () => {
  // Given disc file stems
  // When galleryTitle formats them
  // Then spaces and case match the gallery labels
  assert.equal(galleryTitle("mega-tel"), "Mega Tel");
  assert.equal(galleryTitle("flex-2012-2013"), "Flex 2012 2013");
  assert.equal(galleryTitle("c0zmo"), "C0zmo");
});

test("parseGalleryIndex keeps discs with a file name", () => {
  // Given an index JSON with mixed entries
  // When parseGalleryIndex reads it
  const { discs } = parseGalleryIndex(
    JSON.stringify({
      discs: [
        { id: "mega-tel", title: "Mega Tel", file: "mega-tel.ssd", png: "mega-tel.png" },
        { file: "orcan.ssd" },
        { title: "no file" },
      ],
    }),
  );
  // Then only rows with a file remain, and missing fields are filled
  assert.equal(discs.length, 2);
  assert.equal(discs[0].png, "mega-tel.png");
  assert.equal(discs[1].id, "orcan");
  assert.equal(discs[1].title, "Orcan");
  assert.equal(discs[1].png, null);
});
