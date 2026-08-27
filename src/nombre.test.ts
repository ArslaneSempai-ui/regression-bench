/**
 * CE QUE LA LECTURE D'UN NOMBRE DOIT REFUSER DE FAIRE.
 *
 * `Number("")` vaut zéro. C'est la forme entière du défaut : la conversion réussit, la
 * garde `Number.isFinite` passe, la borne `Math.max(1, …)` remonte poliment le zéro, et
 * personne ne voit jamais rien. Le dépôt l'a payé une fois côté serveur ; la démo publiée
 * a gardé la faute plusieurs jours après, sur la même route et le même paramètre.
 *
 * Les cas ci-dessous tiennent les deux moitiés, parce que réparer l'une sans l'autre est
 * exactement ce qui s'est produit :
 *   — la FONCTION lit correctement une chaîne vide ;
 *   — les POINTS D'APPEL, y compris celui qui part dans la page publiée, s'en servent.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { entierBorne } from "./nombre.ts";
import { measureStability } from "./stability.ts";
import { VERSIONS } from "./screening.ts";
import { CASES } from "./cases.ts";

const racine = fileURLToPath(new URL("..", import.meta.url));

test("a present-but-empty parameter is 'not supplied', never zero", () => {
  /* Les quatre formes qu'un paramètre vide prend selon d'où il vient : une route
     (`URLSearchParams.get`), une variable d'environnement posée sans valeur, un argument
     de ligne de commande entre guillemets, et l'absence franche. */
  for (const vide of ["", "   ", "\t", null, undefined]) {
    const lu = entierBorne(vide, 8, 1, 25);
    assert.equal(lu.valeur, 8,
      `entierBorne(${JSON.stringify(vide)}) rend ${lu.valeur} au lieu du défaut 8 — `
      + "`Number(\"\")` vaut zéro, et un zéro borné à 1 se lit comme un choix");
    assert.equal(lu.fourni, false, `${JSON.stringify(vide)} ne fournit rien`);
  }
});

test("a non-numeric parameter falls back rather than becoming NaN", () => {
  for (const brut of ["abc", "1e", "--", "Infinity"]) {
    assert.equal(entierBorne(brut, 8, 1, 25).valeur, 8, `entierBorne(${JSON.stringify(brut)})`);
  }
});

test("a value out of bounds is clamped AND says so", () => {
  const haut = entierBorne("100000", 8, 1, 25);
  assert.equal(haut.valeur, 25);
  assert.equal(haut.ramene, true, "une valeur rabotée en silence fait chercher pourquoi le résultat ne bouge plus");

  const bas = entierBorne("0", 8, 1, 25);
  assert.equal(bas.valeur, 1);
  assert.equal(bas.ramene, true);

  const dedans = entierBorne("12", 8, 1, 25);
  assert.equal(dedans.valeur, 12);
  assert.equal(dedans.ramene, false, "une valeur dans les bornes n'est pas ramenée");
});

test("zero rounds would report the unstable version as stable — which is what the guard buys", async () => {
  /*
   * LE COÛT, MESURÉ PLUTÔT QU'AFFIRMÉ.
   *
   * Ce cas ne teste pas la garde : il montre ce qui arrive quand elle manque, pour que
   * personne ne la retire en la prenant pour de la coquetterie. `v4-sous-budget` court
   * après une horloge — c'est sa raison d'être dans ce banc — et zéro tour de mesure ne
   * peut observer aucun désaccord, donc le rend « stable ».
   */
  const aucun = await measureStability("v4", VERSIONS["v4-sous-budget"], CASES, 0);
  assert.equal(aucun.stable, true,
    "si zéro tour ne rendait plus « stable », ce cas ne démontrerait plus rien");
  assert.equal(aucun.unstable.length, 0);

  /* Et la lecture gardée ne peut pas produire ce zéro, quelle que soit l'entrée. */
  for (const brut of ["", "   ", "0", "-5", "abc", null]) {
    assert.ok(entierBorne(brut, 8, 1, 25).valeur >= 1,
      `entierBorne(${JSON.stringify(brut)}) doit rester >= 1 tour`);
  }
});

test("no call site reads a run count without the guard — the published shim included", () => {
  /*
   * ─── LE TÉMOIN AU POINT D'APPEL ───
   *
   * Éprouver `entierBorne` ne prouve rien sur les endroits qui l'appellent. Le défaut
   * d'origine était précisément là : la fonction de lecture du serveur était juste, et le
   * shim de la démo — un autre point d'appel, dans un gabarit — faisait `Number(q.get(…))`
   * à côté. Une suite verte sur la fonction n'aurait rien vu.
   *
   * On lit donc les sources ET la page construite, parce que c'est la page que le visiteur
   * exécute.
   */
  const cibles: [string, string][] = [
    ["src/pages.ts", readFileSync(racine + "src/pages.ts", "utf8")],
    ["src/server.ts", readFileSync(racine + "src/server.ts", "utf8")],
    ["src/stability.ts", readFileSync(racine + "src/stability.ts", "utf8")],
    ["src/figer-stabilite.ts", readFileSync(racine + "src/figer-stabilite.ts", "utf8")],
    ["docs/index.html", readFileSync(racine + "docs/index.html", "utf8")],
  ];

  /* Les commentaires sont retirés en PRÉSERVANT LE NOMBRE DE LIGNES : ces fichiers
     décrivent le défaut en toutes lettres, et une règle qui se déclenche sur sa propre
     explication est la faute que ce dépôt passe ses journées à décrire. */
  const sansCommentaires = (t: string): string => t
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

  /* `Number(...)` appliqué à ce qui vient du dehors : une route, l'environnement, argv. */
  const FAUTIF = /\bNumber\(\s*(?:q\.get|url\.searchParams\.get|process\.env|arg\()/;

  const fautifs: string[] = [];
  for (const [nom, texte] of cibles) {
    sansCommentaires(texte).split("\n").forEach((l, i) => {
      if (FAUTIF.test(l)) fautifs.push(`${nom}:${i + 1}  ${l.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(fautifs, [],
    "une entrée extérieure est convertie avant d'être qualifiée :\n  " + fautifs.join("\n  ")
    + "\n  → `entierBorne(brut, defaut, min, max)` de nombre.ts : vide ≠ zéro.");

  /*
   * PROUVER QUE LE BALAYAGE A REGARDÉ. Un motif qui ne reconnaît plus rien rend la même
   * liste vide qu'un dépôt sain, et se lit comme un succès.
   */
  assert.ok(FAUTIF.test('const rounds = Number(q.get("runs") ?? 8);'),
    "le motif ne reconnaît plus la forme fautive d'origine : un zéro ne prouverait rien");
  assert.equal(cibles.length, 5, "une cible a disparu de la liste");

  /* Et la page publiée est bien celle qui porte la lecture gardée, pas seulement les
     sources : un `npm run pages` oublié laisserait le shim fautif en ligne. */
  const page = cibles[cibles.length - 1]![1];
  assert.ok(page.includes("window.LOCAL ="),
    "docs/index.html ne porte pas de shim — ce contrôle ne lit plus ce qu'il croit lire");
  assert.match(page, /entierBorne\(\s*q\.get\("runs"\)/,
    "le shim publié ne lit pas le nombre de tours par la lecture gardée — relancer `npm run pages`");
});
