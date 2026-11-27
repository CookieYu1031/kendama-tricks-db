"use strict";
// v0.20.4: view-mode chip order (grip, parts, class, text) and chip kind classes.
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("../_load");

function mkEl(){
  const set = [];
  const el = {
    children: [], textContent: "", className: "", style: {}, dataset: {},
    addEventListener(){}, setAttribute(){},
    appendChild(c){ el.children.push(c); return c; },
    classList: {
      add(){ for(const n of arguments) if(set.indexOf(n) === -1) set.push(n); },
      remove(n){ const i = set.indexOf(n); if(i !== -1) set.splice(i, 1); },
      toggle(n, f){ if(f) this.add(n); else this.remove(n); },
      contains(n){ return set.indexOf(n) !== -1 || el.className.split(/\s+/).indexOf(n) !== -1; }
    }
  };
  return el;
}
const c = load(["js/01-data-model.js", "js/01-data-storage.js", "js/02-constants-colors-icons.js", "js/03-i18n.js", "js/04-state.js", "js/05-data-helpers.js", "js/05-data-ops.js", "js/05-data-util.js",
  "js/07-id.js", "js/08-loc-code.js", "js/09-names.js", "js/30-drawer-logic.js", "js/31-drawer-sections.js", "js/32-trick-drawer.js", "js/33-drawer-tags.js"],
  { document: { createElement: mkEl, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener(){} } });

test("flow chips: grip, parts, class, text; tags carry kind class and active", () => {
  c.state.lang = "zh";
  c.db.tags = [
    { id: "gc", name: { zh: "類", jp: "", en: "" }, kind: "class", combo: { grip: null, parts: [] } },
    { id: "gt", name: { zh: "文", jp: "", en: "" }, kind: "text" }
  ];
  const tr = { grip: "ken", parts: ["sara"], tagIds: ["gt", "gc"] };
  const parent = mkEl();
  c.buildDrawerFlowChips(tr, parent);
  const chips = parent.children[0].children;
  assert.strictEqual(chips.length, 4);
  assert.ok(!chips[0].classList.contains("tag-class") && !chips[0].classList.contains("tag-text"));
  assert.ok(!chips[1].classList.contains("tag-class") && !chips[1].classList.contains("tag-text"));
  assert.ok(chips[2].classList.contains("tag-class") && chips[2].classList.contains("active"));
  assert.ok(chips[3].classList.contains("tag-text") && chips[3].classList.contains("active"));
  assert.strictEqual(chips[2].textContent, "類");
  assert.strictEqual(chips[3].textContent, "文");
});
