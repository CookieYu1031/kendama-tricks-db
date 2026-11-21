"use strict";
// v0.9.3: part diagram svg, 皿胴 removal, drawer section gating, video slot names, no tag creation in drawer.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const { load } = require("./_load");

const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
  "js/07-id.js", "js/08-loc-code.js", "js/09-names.js", "js/30-drawer-logic.js", "js/31-drawer-sections.js",
  "js/32-trick-drawer.js", "js/33-drawer-tags.js", "js/34-drawer-videos.js", "js/35-part-diagram.js"],
  { URL, state: { lang: "zh", activeSpace: "t00" } });

test("diagram has one region per PART_KEY, none for saraDo", () => {
  const svg = c.partDiagramSvg([], false);
  c.PART_KEYS.forEach(k => assert.ok(svg.indexOf('data-part="' + k + '"') !== -1, k));
  assert.strictEqual((svg.match(/data-part="/g) || []).length, c.PART_KEYS.length);
  assert.ok(svg.indexOf("saraDo") === -1);
});

test("selected parts get .on; interactive adds role=button", () => {
  const svg = c.partDiagramSvg(["kensaki", "ana"], true);
  assert.match(svg, /class="pd-part on" data-part="kensaki"/);
  assert.match(svg, /class="pd-part on" data-part="ana"/);
  assert.match(svg, /class="pd-part" data-part="sara"/);
  assert.match(svg, /role="button"/);
  assert.doesNotMatch(c.partDiagramSvg(["ana"], false), /role="button"/);
  assert.match(c.partDiagramSvg([], true), /class="part-diagram interactive"/);
});

test("string hole removed; junction + tamaPoint added; tamaTop kept", () => {
  assert.ok(c.PART_KEYS.indexOf("stringHole") === -1);
  ["junction", "tamaPoint", "tamaTop"].forEach(k => assert.ok(c.PART_KEYS.indexOf(k) !== -1, k));
  assert.match(c.partDiagramSvg([], false), /<rect class="pd-shape pd-dash"/);
  const n = c.normalizeDB({ categories: [], tricks: [{ id: "x", parts: ["stringHole", "tamaTop"] }] }).tricks[0];
  assert.deepStrictEqual(Array.from(n.parts), ["tamaTop"]);
  assert.deepStrictEqual(Array.from(c.normalizeCombo({ grip: "tama", parts: ["stringHole"] }).parts), []);
});

test("hierarchy: PART_PARENT, expandParts, partMatches", () => {
  assert.strictEqual(c.PART_PARENT.kensaki, "kenchou");
  assert.strictEqual(c.PART_PARENT.chuzaraEdge, "chuzara");
  assert.deepStrictEqual(Array.from(c.expandParts(["kensaki"])).sort(), ["kenchou", "kensaki"]);
  assert.strictEqual(c.partMatches(["kensaki"], "kenchou"), true);   // parent filter matches child tag
  assert.strictEqual(c.partMatches(["kenchou"], "kensaki"), false);  // not the other way round
  assert.strictEqual(c.partMatches(["chuzaraEdge"], "chuzara"), true);
  assert.strictEqual(c.partMatches(["sara"], "chuzara"), false);
});

test("diagram: lit parent lights child area (inh); child can be lit alone", () => {
  assert.match(c.partDiagramSvg(["kenchou"], false), /class="pd-part inh" data-part="kensaki"/);
  assert.match(c.partDiagramSvg(["chuzara"], false), /class="pd-part inh" data-part="chuzaraEdge"/);
  const alone = c.partDiagramSvg(["kensaki"], false);
  assert.match(alone, /class="pd-part on" data-part="kensaki"/);
  assert.match(alone, /class="pd-part" data-part="kenchou"/);
});

test("createPartDiagram.update re-colors in place", () => {
  const els = {};
  const mk = k => { const e = { a: {}, getAttribute: n => (n === "data-part" ? k : e.a[n]), setAttribute: (n, v) => { e.a[n] = v; } }; els[k] = e; return e; };
  const ctx = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js", "js/35-part-diagram.js"],
    { URL, state: { lang: "zh" } });
  ctx.document.createElement = () => ({ innerHTML: "", className: "", addEventListener() {}, querySelectorAll() { return ctx.PART_KEYS.map(mk); } });
  const box = ctx.createPartDiagram({ selected: ["kensaki"], interactive: true, onToggle() {} });
  const html = box.innerHTML;
  box.update(["kenchou", "ana"]);
  assert.strictEqual(box.innerHTML, html);               // svg not replaced
  assert.strictEqual(els.kenchou.a.class, "pd-part on");
  assert.strictEqual(els.kensaki.a.class, "pd-part inh");
  assert.strictEqual(els.ana.a["aria-pressed"], "true");
  assert.strictEqual(els.sara.a["aria-pressed"], "false");
  assert.deepStrictEqual(Array.from(box.selected), ["kenchou", "ana"]);
});

test("sara alone tints rims (sub); saraEdge makes them on", () => {
  assert.match(c.partDiagramSvg(["sara"], false), /class="pd-part sub" data-part="saraEdge"/);
  assert.match(c.partDiagramSvg(["sara", "saraEdge"], false), /class="pd-part on" data-part="saraEdge"/);
});

test("saraDo / 皿胴 removed from keys, strings and normalization", () => {
  assert.ok(c.PART_KEYS.indexOf("saraDo") === -1);
  ["zh", "jp", "en"].forEach(l => assert.strictEqual(c.UI[l].part_saraDo, undefined));
  const t = c.normalizeDB({ categories: [], tricks: [{ id: "x", parts: ["saraDo", "sara"] }] }).tricks[0];
  assert.deepStrictEqual(Array.from(t.parts), ["sara"]);
  assert.deepStrictEqual(Array.from(c.normalizeCombo({ grip: "ken", parts: ["saraDo", "kensaki"] }).parts), ["kensaki"]);
});

test("drawerSections.diagram: view mode only when parts exist", () => {
  assert.strictEqual(c.drawerSections({ parts: [] }, false, false).diagram, false);
  assert.strictEqual(c.drawerSections({ parts: ["sara"] }, false, false).diagram, true);
  assert.strictEqual(c.drawerSections({ parts: ["sara"] }, true, true).diagram, false); // edit mode embeds it with chips
});

test("video slot site names", () => {
  assert.strictEqual(c.videoSourceName("https://youtu.be/x"), "YouTube");
  assert.strictEqual(c.videoSourceName("https://www.instagram.com/reel/x"), "Instagram");
  assert.strictEqual(c.videoSourceName("https://example.com/v"), "連結");
});

test("drawer no longer creates / deletes tags; head strings exist", () => {
  const src = fs.readFileSync(__dirname + "/../js/33-drawer-tags.js", "utf8");
  assert.ok(src.indexOf("addTagToTrick") === -1 && src.indexOf("removeTag(") === -1 && src.indexOf("newTagPlaceholder") === -1);
  assert.strictEqual(typeof c.addTagToTrick, "undefined");
  ["zh", "jp", "en"].forEach(l => assert.ok(c.UI[l].editIconColor));
});

test("view-mode names: two short names pair up, long or single ones don't", () => {
  assert.strictEqual(c.namesFitSideBySide([["JP", "とうだい"], ["EN", "Lighthouse"]]), true);
  assert.strictEqual(c.namesFitSideBySide([["JP", "とうだい"]]), false);
  assert.strictEqual(c.namesFitSideBySide([["JP", "とうだいとうだいとうだい"], ["EN", "Lighthouse"]]), false);
  assert.strictEqual(c.otherNames({ zh: "燈台", jp: "とうだい", en: "Lighthouse" }, "jp").some(p => p[0] === "TW"), true);
});
