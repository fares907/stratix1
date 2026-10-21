// Runs after `vite build`: writes dist/public/en.html, the English entry point
// served at /en. The app itself is the same bundle; only what a crawler or a
// link preview reads before any JavaScript runs differs — language and
// direction, title, description, canonical, share tags, structured data and
// the no-JavaScript fallback. Each localized block is fenced by markers in
// client/index.html; a missing marker fails the build rather than shipping a
// page that is half Arabic.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist", "public");
const html = await readFile(path.join(dist, "index.html"), "utf8");

function swap(source, name, replacement) {
  const start = `<!-- i18n:${name} -->`;
  const end = `<!-- /i18n:${name} -->`;
  const from = source.indexOf(start);
  const to = source.indexOf(end);
  if (from < 0 || to < from) throw new Error(`build-en: markers for "${name}" not found in index.html`);
  return source.slice(0, from + start.length) + "\n" + replacement + "    " + source.slice(to);
}

const opening = '<html lang="ar" dir="rtl" class="dark">';
if (!html.includes(opening)) throw new Error(`build-en: ${opening} not found`);

let en = html.replace(opening, '<html lang="en" dir="ltr" class="dark">');
en = swap(en, "head", await readFile(path.join(root, "client", "i18n", "en.head.html"), "utf8"));
en = swap(en, "noscript", await readFile(path.join(root, "client", "i18n", "en.noscript.html"), "utf8"));

await writeFile(path.join(dist, "en.html"), en);
console.log("wrote en.html");
