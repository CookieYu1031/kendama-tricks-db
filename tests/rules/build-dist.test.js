"use strict";
// Deploy build (scripts/build-dist.js): pure functions only; no esbuild, no network.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const B = require("../../scripts/build-dist.js");
const ROOT = path.join(__dirname, "..", "..");

const HTML = [
  '<script>/* boot */var a=1;</script>',
  '<link href="https://fonts.googleapis.com/css2?family=X" rel="stylesheet">',
  '<link rel="stylesheet" href="css/one.css">',
  '<link rel="stylesheet" href="css/two.css">',
  '<script src="https://www.gstatic.com/x.js"></script>',
  '<script src="js/b.js"></script>',
  '<script src="js/a.js"></script>'
].join("\n") + "\n";

test("hashedName: stable, content based, keeps stem and ext", () => {
  const n = B.hashedName("js/01-data-model.js", "abc");
  assert.match(n, /^01-data-model\.[0-9a-f]{10}\.js$/);
  assert.strictEqual(n, B.hashedName("js/01-data-model.js", "abc"));
  assert.notStrictEqual(n, B.hashedName("js/01-data-model.js", "abd"));
  assert.match(B.hashedName("app.css", "x"), /^app\.[0-9a-f]{10}\.css$/);
});

test("rewriteHtml: script order kept, css merged at first link, others untouched", () => {
  const out = B.rewriteHtml(HTML, { "js/b.js": "a/b.1111111111.js", "js/a.js": "a/a.2222222222.js" }, "a/app.3333333333.css");
  assert.deepStrictEqual(B.listScripts(HTML), ["js/b.js", "js/a.js"]);
  assert.ok(out.indexOf("a/b.1111111111.js") < out.indexOf("a/a.2222222222.js"));
  assert.strictEqual(out.split('rel="stylesheet"').length - 1, 2); // font link + merged
  assert.ok(out.indexOf("fonts.googleapis.com") < out.indexOf("a/app.3333333333.css"));
  assert.ok(!/css\/one|css\/two/.test(out));
  assert.ok(out.indexOf("<script>/* boot */var a=1;</script>") === 0);
  assert.ok(out.includes('<script src="https://www.gstatic.com/x.js"></script>'));
  assert.throws(() => B.rewriteHtml(HTML, {}, "a/x.css"), /not built/);
});

test("mergeCss: files in order, url() rewritten for /a/, data urls kept", () => {
  const files = { "css/one.css": '.a{background:url("../assets/x.png")}', "css/two.css": ".b{background:url(data:image/png;base64,AA)} @charset \"utf-8\";" };
  const css = B.mergeCss(["css/one.css", "css/two.css"], (f) => files[f], () => true);
  assert.ok(css.indexOf(".a{") < css.indexOf(".b{"));
  assert.ok(css.includes('url("../assets/x.png")')); // css/ -> assets/ resolves to ../assets from /a/
  assert.ok(css.includes("url(data:image/png;base64,AA)"));
  assert.ok(!css.includes("@charset"));
  assert.strictEqual(B.rewriteCssUrls('x{background:url(img/p.png?v=1)}', "css/y.css", () => true), "x{background:url(../css/img/p.png?v=1)}");
  assert.throws(() => B.mergeCss(["css/x.css"], () => '@import "y.css";', () => true), /@import/);
  assert.throws(() => B.rewriteCssUrls("x{background:url(nope.png)}", "css/x.css", () => false), /not found/);
});

test("real css files merge without error", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const styles = B.listStyles(html);
  assert.ok(styles.length > 5);
  B.mergeCss(styles, (f) => fs.readFileSync(path.join(ROOT, f), "utf8"), (r) => fs.existsSync(path.join(ROOT, r)));
});

test("buildDeployConfig: public dist, immutable /a/ last, rules kept", () => {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8"));
  const cfg = B.buildDeployConfig(base);
  assert.strictEqual(cfg.hosting.public, "dist");
  assert.ok(!cfg.hosting.ignore.some((p) => /^dist/.test(p)));
  const last = cfg.hosting.headers[cfg.hosting.headers.length - 1];
  assert.strictEqual(last.source, "/a/**");
  assert.deepStrictEqual(last.headers, [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]);
  assert.strictEqual(cfg.hosting.headers.length, base.hosting.headers.length + 1);
  assert.deepStrictEqual(cfg.firestore, base.firestore);
  assert.strictEqual(base.hosting.public, ".");
  assert.ok(base.hosting.ignore.includes("dist/**"));
});

test("missingNames: detects lost top-level function/var", () => {
  const src = "function foo(){}\nvar bar = 1;\nasync function baz(){}\n";
  assert.strictEqual(B.topLevelNames(src).length, 3);
  assert.strictEqual(B.missingNames(src, "function foo(){}var bar=1;async function baz(){}").length, 0);
  assert.strictEqual(B.missingNames(src, "var a=1,bar=2;function foo(){}").map((n) => n.name).join(), "baz");
  assert.strictEqual(B.missingNames(src, "function a(){}var b=1;").length, 3);
});

test("localRefs: skips remote/data refs", () => {
  const r = B.localRefs('<link href="https://x/y.css" rel="stylesheet"><script src="a/b.js"></script><link rel="manifest" href="m.webmanifest">');
  assert.deepStrictEqual(r, ["a/b.js", "m.webmanifest"]);
});
