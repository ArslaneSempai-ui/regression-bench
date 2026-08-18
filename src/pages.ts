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

const SHIM = `<script>window.LOCAL_PRET = new Promise((r) => { window.LOCAL_POSE = r; });</script>\n<script type="module">
import { run, save, load, runs } from "./js/bench.js";
import { CASES } from "./js/cases.js";
import { REFERENCE_STABILITE } from "./js/reference-stabilite.js";
import { VERSIONS } from "./js/screening.js";
import { compare } from "./js/diff.js";
import { measureStability } from "./js/stability.js";

const byCase = Object.fromEntries(CASES.map((c) => [c.id, { input: c.input, why: c.why }]));
const summary = () => runs().map((e) => ({
  version: e.version, le: e.le, passed: e.passed, total: e.total, rate: e.rate,
}));

/* Le résultat de chaque cas, version par version — la grille de l'écran. Le serveur le
 * calcule aussi ; il est ici parce que la démo n'a pas de serveur, et qu'un champ oublié
 * ne casse rien : il laisse une section vide en ligne, pendant des semaines. */
const grille = () => ({
  cas: CASES.map((c) => c.id),
  reference: REFERENCE_STABILITE,
  versions: runs().map((e) => ({
    version: e.version,
    passes: CASES.map((c) => e.results.find((r) => r.caseId === c.id)?.passed ?? null),
  })),
});

async function runAll() {
  for (const [name, system] of Object.entries(VERSIONS)) save(await run(name, system, CASES));
}

/*
 * La démo arrive avec ses quatre exécutions déjà faites.
 *
 * Elle démarrait vide, comme un clone frais : c'était fidèle, et c'était le mauvais
 * arbitrage. Les deux figures qui portent la thèse — les barres et la grille des cas —
 * n'existaient pas tant que personne n'avait cliqué, et un visiteur qui passe trente
 * secondes sur la page repartait sans avoir vu ce que l'outil démontre.
 *
 * Rien n'est mis en conserve pour autant : les quatre versions tournent vraiment, dans le
 * navigateur, sur les vingt-deux cas. Le bouton « relancer » fait toujours exactement la
 * même chose, et la première demande d'état l'attend au lieu de renvoyer un banc vide.
 * L'amorçage n'a lieu qu'une fois : on garde la promesse, pas le résultat, donc deux
 * appels concurrents au chargement ne lancent pas huit exécutions.
 *
 * (Pas d'accent grave dans ce bloc : il vit lui-même dans un gabarit.)
 */
let amorce = null;

window.LOCAL = async (chemin, methode) => {
  if (chemin === "/api/state") {
    await (amorce ??= runAll());
    return { runs: summary(), cases: byCase, totalCases: CASES.length, grille: grille() };
  }
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

/* Le shim est en place : l'écran peut partir. La balise classique qui a créé la promesse
 * s'exécute avant tout module, donc personne ne peut la manquer. */
window.LOCAL_POSE && window.LOCAL_POSE();
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
  html = html.replace('from "/graphes.js"', 'from "./graphes.js"');

  const header = html.indexOf('class="haut"');
  const closes = html.indexOf("\n  </div>", header) + "\n  </div>".length;
  html = html.slice(0, closes) + "\n" + BANNER + html.slice(closes);
  html = html.replace('<script type="module">', SHIM + '<script type="module">');
  writeFileSync(docs + "/index.html", html);

  cpSync(root + "src/registre.css", docs + "/registre.css");
  cpSync(root + "src/graphes.js", docs + "/graphes.js");
  if (existsSync(root + "images")) cpSync(root + "images", docs + "/images", { recursive: true });
  writeFileSync(docs + "/.nojekyll", "");

  console.log("docs/ built — commit it and enable GitHub Pages on the docs folder");
}

if (isMain(import.meta)) build();
