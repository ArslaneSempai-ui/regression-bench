import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "./bench.ts";
import { compare, summarise, DURATION_NOISE_MS } from "./diff.ts";
import { measureStability } from "./stability.ts";
import { screenExact, screenNormalised, screenFuzzy, VERSIONS } from "./screening.ts";
import { CASES } from "./cases.ts";
import type { Case } from "./bench.ts";

const petitJeu: Case<number, number>[] = [
  { id: "a", why: { fr: "double", en: "double" }, input: 2, expected: 4 },
  { id: "b", why: { fr: "double", en: "double" }, input: 3, expected: 6 },
  { id: "c", why: { fr: "double", en: "double" }, input: 4, expected: 8 },
];

test("une exception dans le système fait échouer le cases, pas le banc", async () => {
  const e = await run("casse", (n: number) => {
    if (n === 3) throw new Error("boum");
    return n * 2;
  }, petitJeu);

  assert.equal(e.total, 3, "les cas suivants sont quand même exécutés");
  assert.equal(e.passed, 2);
  assert.equal(e.results.find((r) => r.caseId === "b")?.error, "boum");
});

test("une régression est signalée même quand le rate monte", async () => {
  // Trois cas justes, puis une version qui en gagne un et en casse un autre.
  const before = await run("before", (n: number) => (n === 4 ? 0 : n * 2), petitJeu);
  const after = await run("after", (n: number) => (n === 2 ? 0 : n * 2), petitJeu);

  const c = compare(before, after);
  assert.equal(c.rateBefore, c.rateAfter, "le rate est identique");
  assert.equal(c.verdict, "regression", "et pourtant un cas validé est cassé");
  assert.equal(c.regressions.length, 1);
  assert.equal(c.gains.length, 1);
});

test("le verdict reste « régression » quand les gains dépassent les pertes", async () => {
  const before = await run("a", (n: number) => (n === 2 ? n * 2 : 0), petitJeu);
  const after = await run("b", (n: number) => (n === 2 ? 0 : n * 2), petitJeu);

  const c = compare(before, after);
  assert.ok(c.rateAfter > c.rateBefore, "la moyenne s'améliore");
  assert.equal(c.verdict, "regression", "un cas cassé suffit à rendre le changement suspect");
  assert.match(summarise(c), /régression/);
});

test("deux jeux sans cas commun ne se comparent pas", async () => {
  const before = await run("a", (n: number) => n * 2, petitJeu);
  const after = await run("b", (n: number) => n * 2,
    [{ id: "z", why: { fr: "autre", en: "autre" }, input: 1, expected: 2 }]);

  const c = compare(before, after);
  assert.equal(c.verdict, "incomparable");
  assert.equal(c.added.length, 1);
  assert.equal(c.removed.length, 3);
});

test("un changement de output sans changement de verdict est signalé", async () => {
  const jeu: Case<number, unknown>[] = [{ id: "x", why: { fr: "échoue des deux côtés", en: "échoue des deux côtés" }, input: 1, expected: "expected" }];
  const before = await run("a", () => "faux-1", jeu);
  const after = await run("b", () => "faux-2", jeu);

  const c = compare(before, after);
  assert.equal(c.silent.length, 1, "même échec, autre cause : ça vaut d'être vu");
});

test("le bruit de durée ne remonte pas comme un signal", async () => {
  const before = await run("a", (n: number) => n * 2, petitJeu);
  const after = await run("b", (n: number) => n * 2, petitJeu);
  const c = compare(before, after);
  // Des microsecondes d'écart peuvent faire des centaines de pourcents.
  assert.ok(!summarise(c).includes("durée") || Math.abs(c.durationAfter - c.durationBefore) >= DURATION_NOISE_MS);
});

test("l'instabilité est détectée, et seulement quand elle existe", async () => {
  const stable = await measureStability("stable", (n: number) => n * 2, petitJeu, 5);
  assert.equal(stable.stable, true);

  let tour = 0;
  const bascule = await measureStability("bascule",
    (n: number) => (n === 3 && tour++ % 2 === 0 ? 0 : n * 2), petitJeu, 6);
  assert.equal(bascule.stable, false);
  assert.equal(bascule.unstable[0].caseId, "b");
  assert.equal(bascule.unstable[0].outputs.length, 2, "deux outputs distinctes observées");
});

/* --- le système évalué, pour lui-même --- */

test("chaque version fait bien ce qu'elle annonce", () => {
  assert.equal(screenExact("AMINA HADDAD"), null, "l'exact ne pardonne pas la casse");
  assert.equal(screenNormalised("AMINA HADDAD"), "Amina Haddad");
  assert.equal(screenNormalised("Haddad Amina"), "Amina Haddad", "l'ordre des mots est absorbé");
  assert.equal(screenNormalised("Amina Haddadd"), null, "la faute de frappe échappe encore");
  assert.equal(screenFuzzy("Amina Haddadd"), "Amina Haddad");
});

test("la version approximative confond deux noms courts distincts", () => {
  // Le défaut que tout le jeu existe pour attraper.
  assert.equal(screenNormalised("Li Wen"), null, "la v2 avait raison");
  assert.equal(screenFuzzy("Li Wen"), "Li Wei", "la v3 se trompe, et le banc doit le dire");
});

test("aucune version ne fait correspondre une chaîne vide", () => {
  for (const [name, system] of Object.entries(VERSIONS)) {
    assert.equal(system(""), null, `${name} fait correspondre le vide`);
    assert.equal(system("   "), null, `${name} fait correspondre des espaces`);
  }
});

test("chaque cas du jeu explique why il existe, dans les deux langues", () => {
  for (const c of CASES) {
    for (const langue of ["fr", "en"] as const) {
      assert.ok(c.why[langue].length > 15,
        `le cas ${c.id} n'explique pas sa raison d'être en ${langue}`);
    }
  }
  const ids = CASES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "identifiants dupliqués");
});

test("le jeu contient assez de cas négatifs pour ne pas récompenser un système qui dit oui à tout", () => {
  const negatifs = CASES.filter((c) => c.expected === null).length;
  assert.ok(negatifs / CASES.length >= 0.3, `seulement ${negatifs} cas négatifs sur ${CASES.length}`);
});

test("no French survives in the English half of the case set", () => {
  /*
   * This detector must contain French words, and must match whole words only.
   *
   * A mechanical rename replaced "nom" with "name" inside this very regex, turning the
   * guard into a false-alarm generator: it flagged the English word "name" in English
   * text. The repair then dropped the word boundaries, which would have flagged "cases"
   * for containing "cas". Both were caught by this test failing — which is the whole
   * argument for having it.
   */
  const french = /\b(cas|nom|pas|une|des|qui|sur|dans|correspondance|saisie|réponse|dossier)\b/i;
  for (const c of CASES) {
    assert.ok(!french.test(c.why.en), `${c.id}: "${c.why.en}"`);
  }
  // The guard guards itself: a detector matching nothing would pass in silence.
  assert.ok(french.test("le nom du dossier"), "the detector no longer detects French");
});
