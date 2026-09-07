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

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { isMain } from "./cli.ts";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const empreinte = (chemin: string): string =>
  createHash("sha256").update(readFileSync(chemin)).digest("hex");

/**
 * UN REMPLACEMENT QUI NE TROUVE RIEN NE LÈVE PAS — IL RÉÉCRIT LE FICHIER INCHANGÉ.
 *
 * `String.replace` sur un motif absent rend la chaîne telle quelle, sans un mot. Les trois
 * remplacements de cette construction transforment des chemins ABSOLUS (`/registre.css`,
 * `/graphes.js`) en chemins relatifs, parce que GitHub Pages sert ce dépôt sous
 * `/regression-bench/` et non à la racine. Le jour où une ancre est renommée dans
 * `ui.html`, la page se construit sans erreur, se publie, et le navigateur reçoit deux 404 :
 * la feuille de style et le module des figures. L'écran s'affiche nu et personne ne le voit
 * depuis une machine locale, où les mêmes chemins absolus sont justes.
 *
 * La construction refuse donc au lieu de rendre une page muette.
 */
function remplacer(html: string, cherche: string, par: string, quoi: string): string {
  if (!html.includes(cherche)) {
    throw new Error(
      `building the page: ${quoi} not found in src/ui.html (\`${cherche}\`).\n`
      + "  The replacement would have returned the file unchanged and the build would have\n"
      + "  succeeded: the published page would ship an absolute path that is a 404 under\n"
      + "  GitHub Pages.\n"
      + "  -> realign the anchor in src/ui.html, or this pattern on the anchor.");
  }
  return html.replace(cherche, par);
}

const SHIM = `<script>window.LOCAL_PRET = new Promise((r) => { window.LOCAL_POSE = r; });</script>\n<script type="module">
import { run, save, load, runs } from "./js/bench.js";
import { CASES } from "./js/cases.js";
import { REFERENCE_STABILITE } from "./js/reference-stabilite.js";
import { VERSIONS } from "./js/screening.js";
import { compare } from "./js/diff.js";
import { measureStability } from "./js/stability.js";
import { entierBorne } from "./js/nombre.js";

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
    /* Meme lecture que le serveur, et pour la meme raison : "?runs=" donnait ZERO tour,
       donc aucun cas observe, donc les quatre versions annoncees stables. Bornee aussi :
       la mesure tourne ici dans l onglet du visiteur. */
    const rounds = entierBorne(q.get("runs"), 8, 1, 25).valeur;
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
This runs entirely in your browser: no server, no data leaves your machine, and the runs
you produce are yours alone. The watchlist and the 22 cases are <b>invented</b>; a real
sanctions list runs to hundreds of thousands of entries and cannot be published.
<a href="https://github.com/ArslaneSempai-ui/regression-bench">Source and method</a>.
</p>`;

/** Le relevé daté dont la page tire sa grille — voir `figer-stabilite.ts`. */
export const RELEVE = "releve-stabilite.json";

/**
 * SCELLER CE QUI EST PUBLIÉ, PAS SEULEMENT CE QUI L'A PRODUIT.
 *
 * `demo.test.ts` — la couche partagée — sait contrôler trois choses, et n'en contrôlait
 * AUCUNE ici : il cherche `docs/.sources.json`, ne le trouve pas, et le dit par un
 * `t.diagnostic`. Un diagnostic est vert. Relevé le 27/08/2026 : cinq cas passés, une ligne
 * d'information noyée dans une suite de quatre-vingts secondes, et les neuf modules que le
 * navigateur charge réellement (`docs/js/*.js`) n'étaient tenus par rien.
 *
 * Ce que le manifeste ferme, et que rien d'autre ne fermait :
 *
 *  - `empreintes` — la source a-t-elle bougé depuis la construction ? Les fichiers COPIÉS
 *    verbatim se comparent octet pour octet à leur homonyme de `src/` ; les fichiers
 *    COMPILÉS n'ont pas d'homonyme, donc rien ne les regardait.
 *  - `publies` — le fichier que le navigateur charge est-il celui qu'on a construit ? Une
 *    ligne ajoutée à la main dans `docs/js/screening.js` ne fait bouger aucune source.
 *  - `releve` — les chiffres de la page viennent-ils de la mesure que le dépôt porte
 *    aujourd'hui ? La grille est une mesure datée ; refaire la mesure sans refaire la page
 *    publie des chiffres périmés dont toutes les autres empreintes concordent.
 *
 * Le relevé est écrit par `npm run figer`, pas ici : un manifeste qui scellerait un fichier
 * que la même construction vient d'écrire ne traverserait aucune couture et ne pourrait
 * jamais tomber.
 */
function sceller(docs: string): void {
  const releve = root + RELEVE;
  if (!existsSync(releve)) {
    throw new Error(
      `building the page: ${RELEVE} is missing.\n`
      + "  The page publishes the grid of a dated measurement, and nothing would tie those\n"
      + "  figures to it. -> `npm run figer` writes it alongside src/reference-stabilite.ts.");
  }
  const { empreinte: empreinteReleve } = JSON.parse(readFileSync(releve, "utf8")) as { empreinte?: string };
  if (typeof empreinteReleve !== "string") {
    throw new Error(`${RELEVE} carries no \`empreinte\` field: it seals nothing.`);
  }

  /* Les modules COMPILÉS, déduits de ce que `tsc -p tsconfig.web.json` a réellement émis —
     pas d'une liste écrite à la main, qui figerait la construction d'aujourd'hui. */
  const modules = existsSync(docs + "/js")
    ? readdirSync(docs + "/js").filter((f) => f.endsWith(".js")).sort()
    : [];

  const empreintes: Record<string, string> = {};
  for (const js of modules) {
    const ts = root + "src/" + js.replace(/\.js$/, ".ts");
    if (existsSync(ts)) empreintes["js/" + js] = empreinte(ts);
  }
  if (Object.keys(empreintes).length < 2) {
    throw new Error(
      `building the page: ${Object.keys(empreintes).length} compiled module(s) paired with a `
      + "source.\n  The manifest would no longer cover the build, and a check that examines "
      + "almost nothing always passes.\n  -> did `tsc -p tsconfig.web.json` run before this step? "
      + "(see the `pages` script in package.json)");
  }

  const servis = ["index.html", "registre.css", "graphes.js", ...modules.map((f) => "js/" + f)];
  const publies: Record<string, string> = {};
  for (const rel of servis) {
    if (existsSync(docs + "/" + rel)) publies[rel] = empreinte(docs + "/" + rel);
  }

  writeFileSync(docs + "/.sources.json", JSON.stringify({
    construitLe: new Date().toISOString(),
    empreintes,
    publies,
    releve: { attendu: RELEVE, empreinte: empreinteReleve },
  }, null, 2) + "\n");
}

export function build(): void {
  const docs = root + "docs";
  mkdirSync(docs, { recursive: true });

  let html = readFileSync(root + "src/ui.html", "utf8");
  html = remplacer(html, 'href="/registre.css"', 'href="registre.css"', "le lien de la feuille de style");
  html = remplacer(html, 'from "/graphes.js"', 'from "./graphes.js"', "l'import du module des figures");

  const header = html.indexOf('class="haut"');
  if (header < 0) {
    throw new Error(
      "building the page: the `class=\"haut\"` header is not in src/ui.html.\n"
      + "  `indexOf` returns -1, and `indexOf(x, -1)` restarts from zero: the banner would be\n"
      + "  inserted at the page's first `</div>` (anywhere at all) without an error.");
  }
  const finEntete = html.indexOf("\n  </div>", header);
  if (finEntete < 0) {
    throw new Error(
      "building the page: the src/ui.html header does not close on `\\n  </div>`.\n"
      + "  Without that bound the banner would be spliced in at byte 8, inside the doctype.");
  }
  const closes = finEntete + "\n  </div>".length;
  html = html.slice(0, closes) + "\n" + BANNER + html.slice(closes);
  html = remplacer(html, '<script type="module">', SHIM + '<script type="module">', "le script de l'écran");
  writeFileSync(docs + "/index.html", html);

  cpSync(root + "src/registre.css", docs + "/registre.css");
  cpSync(root + "src/graphes.js", docs + "/graphes.js");
  if (existsSync(root + "images")) cpSync(root + "images", docs + "/images", { recursive: true });
  writeFileSync(docs + "/.nojekyll", "");

  sceller(docs);
  console.log("docs/ built: commit it and enable GitHub Pages on the docs folder");
}

if (isMain(import.meta)) build();
