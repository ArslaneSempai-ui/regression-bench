/**
 * Build the hosted demo.
 *
 * "Clone this and run `npm start`" is a request most readers decline. A link they can click
 * is a different artefact — and a *static snapshot* of one is worse than nothing, because
 * the first thing anyone does is press "run every version" and watch nothing happen.
 *
 * So the demo is not a snapshot. A system under test is a function and the cases are data;
 * once the run store stopped assuming a filesystem, the whole bench compiles to ES modules
 * and runs in the browser. The visitor runs the four versions themselves, compares any two,
 * and measures stability — on their machine, in their tab, and the runs die with it.
 *
 * `src/ui.html` stays the single source. The only difference on the hosted side is a
 * `window.LOCAL` shim answering the same routes with the same shapes.
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { isMain } from "./cli.ts";

const root = new URL("..", import.meta.url).pathname;

const SHIM = `<script type="module">
import { run, save, load, runs } from "./js/bench.js";
import { CASES } from "./js/cases.js";
import { VERSIONS } from "./js/screening.js";
import { compare } from "./js/diff.js";
import { measureStability } from "./js/stability.js";

const byCase = Object.fromEntries(CASES.map((c) => [c.id, { input: c.input, why: c.why }]));
const summary = () => runs().map((e) => ({
  version: e.version, le: e.le, passed: e.passed, total: e.total, rate: e.rate,
}));

async function runAll() {
  for (const [name, system] of Object.entries(VERSIONS)) save(await run(name, system, CASES));
}

/* The bench starts empty on a fresh page, exactly as a fresh clone does. Running the
 * versions is the first thing the screen asks for, and doing it silently on load would
 * hide the step the tool is about. */
window.LOCAL = async (chemin, methode) => {
  if (chemin === "/api/state") return { runs: summary(), cases: byCase, totalCases: CASES.length };
  if (chemin === "/api/run") { await runAll(); return { runs: summary() }; }

  if (chemin.startsWith("/api/compare")) {
    const q = new URLSearchParams(chemin.split("?")[1] ?? "");
    const a = load(q.get("before") ?? ""), b = load(q.get("after") ?? "");
    if (!a || !b) return { error: "execution_introuvable" };
    return compare(a, b);
  }

  if (chemin.startsWith("/api/stability")) {
    const q = new URLSearchParams(chemin.split("?")[1] ?? "");
    const rounds = Number(q.get("runs") ?? 8);
    const versions = [];
    for (const [name, system] of Object.entries(VERSIONS)) {
      versions.push(await measureStability(name, system, CASES, rounds));
    }
    return { runs: rounds, versions };
  }
  return {};
};
` + "</" + "script>\n";

const BANNER = `<p class="renvoi" style="margin-bottom:1.5rem">
This runs entirely in your browser — no server, no data leaves your machine, and the runs
you produce are yours alone. The watchlist and the 22 cases are <b>invented</b>; a real
sanctions list runs to hundreds of thousands of entries and cannot be published.
<a href="https://github.com/ArslaneSempai-ui/regression-bench">Source and method</a>.
</p>`;

export function build(): void {
  const docs = root + "docs";
  mkdirSync(docs, { recursive: true });

  let html = readFileSync(root + "src/ui.html", "utf8");
  html = html.replace('href="/registre.css"', 'href="registre.css"');

  const header = html.indexOf('class="haut"');
  const closes = html.indexOf("\n  </div>", header) + "\n  </div>".length;
  html = html.slice(0, closes) + "\n" + BANNER + html.slice(closes);
  html = html.replace('<script type="module">', SHIM + '<script type="module">');
  writeFileSync(docs + "/index.html", html);

  cpSync(root + "src/registre.css", docs + "/registre.css");
  if (existsSync(root + "images")) cpSync(root + "images", docs + "/images", { recursive: true });
  writeFileSync(docs + "/.nojekyll", "");

  console.log("docs/ built — commit it and enable GitHub Pages on the docs folder");
}

if (isMain(import.meta)) build();
