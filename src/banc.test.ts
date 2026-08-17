import { test } from "node:test";
import assert from "node:assert/strict";
import { lancer } from "./banc.ts";
import { comparer, resume, SEUIL_DUREE_MS } from "./diff.ts";
import { mesurerStabilite } from "./stabilite.ts";
import { criblerExact, criblerNormalise, criblerApproximatif, VERSIONS } from "./criblage.ts";
import { JEU } from "./jeu.ts";
import type { Cas } from "./banc.ts";

const petitJeu: Cas<number, number>[] = [
  { id: "a", pourquoi: { fr: "double", en: "double" }, entree: 2, attendu: 4 },
  { id: "b", pourquoi: { fr: "double", en: "double" }, entree: 3, attendu: 6 },
  { id: "c", pourquoi: { fr: "double", en: "double" }, entree: 4, attendu: 8 },
];

test("une exception dans le système fait échouer le cas, pas le banc", async () => {
  const e = await lancer("casse", (n: number) => {
    if (n === 3) throw new Error("boum");
    return n * 2;
  }, petitJeu);

  assert.equal(e.total, 3, "les cas suivants sont quand même exécutés");
  assert.equal(e.reussis, 2);
  assert.equal(e.resultats.find((r) => r.cas === "b")?.erreur, "boum");
});

test("une régression est signalée même quand le taux monte", async () => {
  // Trois cas justes, puis une version qui en gagne un et en casse un autre.
  const avant = await lancer("avant", (n: number) => (n === 4 ? 0 : n * 2), petitJeu);
  const apres = await lancer("apres", (n: number) => (n === 2 ? 0 : n * 2), petitJeu);

  const c = comparer(avant, apres);
  assert.equal(c.tauxAvant, c.tauxApres, "le taux est identique");
  assert.equal(c.verdict, "regression", "et pourtant un cas validé est cassé");
  assert.equal(c.regressions.length, 1);
  assert.equal(c.gains.length, 1);
});

test("le verdict reste « régression » quand les gains dépassent les pertes", async () => {
  const avant = await lancer("a", (n: number) => (n === 2 ? n * 2 : 0), petitJeu);
  const apres = await lancer("b", (n: number) => (n === 2 ? 0 : n * 2), petitJeu);

  const c = comparer(avant, apres);
  assert.ok(c.tauxApres > c.tauxAvant, "la moyenne s'améliore");
  assert.equal(c.verdict, "regression", "un cas cassé suffit à rendre le changement suspect");
  assert.match(resume(c), /régression/);
});

test("deux jeux sans cas commun ne se comparent pas", async () => {
  const avant = await lancer("a", (n: number) => n * 2, petitJeu);
  const apres = await lancer("b", (n: number) => n * 2,
    [{ id: "z", pourquoi: { fr: "autre", en: "autre" }, entree: 1, attendu: 2 }]);

  const c = comparer(avant, apres);
  assert.equal(c.verdict, "incomparable");
  assert.equal(c.ajoutes.length, 1);
  assert.equal(c.retires.length, 3);
});

test("un changement de sortie sans changement de verdict est signalé", async () => {
  const jeu: Cas<number, unknown>[] = [{ id: "x", pourquoi: { fr: "échoue des deux côtés", en: "échoue des deux côtés" }, entree: 1, attendu: "attendu" }];
  const avant = await lancer("a", () => "faux-1", jeu);
  const apres = await lancer("b", () => "faux-2", jeu);

  const c = comparer(avant, apres);
  assert.equal(c.silencieux.length, 1, "même échec, autre cause : ça vaut d'être vu");
});

test("le bruit de durée ne remonte pas comme un signal", async () => {
  const avant = await lancer("a", (n: number) => n * 2, petitJeu);
  const apres = await lancer("b", (n: number) => n * 2, petitJeu);
  const c = comparer(avant, apres);
  // Des microsecondes d'écart peuvent faire des centaines de pourcents.
  assert.ok(!resume(c).includes("durée") || Math.abs(c.dureeApres - c.dureeAvant) >= SEUIL_DUREE_MS);
});

test("l'instabilité est détectée, et seulement quand elle existe", async () => {
  const stable = await mesurerStabilite("stable", (n: number) => n * 2, petitJeu, 5);
  assert.equal(stable.stable, true);

  let tour = 0;
  const bascule = await mesurerStabilite("bascule",
    (n: number) => (n === 3 && tour++ % 2 === 0 ? 0 : n * 2), petitJeu, 6);
  assert.equal(bascule.stable, false);
  assert.equal(bascule.instables[0].cas, "b");
  assert.equal(bascule.instables[0].sorties.length, 2, "deux sorties distinctes observées");
});

/* --- le système évalué, pour lui-même --- */

test("chaque version fait bien ce qu'elle annonce", () => {
  assert.equal(criblerExact("AMINA HADDAD"), null, "l'exact ne pardonne pas la casse");
  assert.equal(criblerNormalise("AMINA HADDAD"), "Amina Haddad");
  assert.equal(criblerNormalise("Haddad Amina"), "Amina Haddad", "l'ordre des mots est absorbé");
  assert.equal(criblerNormalise("Amina Haddadd"), null, "la faute de frappe échappe encore");
  assert.equal(criblerApproximatif("Amina Haddadd"), "Amina Haddad");
});

test("la version approximative confond deux noms courts distincts", () => {
  // Le défaut que tout le jeu existe pour attraper.
  assert.equal(criblerNormalise("Li Wen"), null, "la v2 avait raison");
  assert.equal(criblerApproximatif("Li Wen"), "Li Wei", "la v3 se trompe, et le banc doit le dire");
});

test("aucune version ne fait correspondre une chaîne vide", () => {
  for (const [nom, systeme] of Object.entries(VERSIONS)) {
    assert.equal(systeme(""), null, `${nom} fait correspondre le vide`);
    assert.equal(systeme("   "), null, `${nom} fait correspondre des espaces`);
  }
});

test("chaque cas du jeu explique pourquoi il existe, dans les deux langues", () => {
  for (const c of JEU) {
    for (const langue of ["fr", "en"] as const) {
      assert.ok(c.pourquoi[langue].length > 15,
        `le cas ${c.id} n'explique pas sa raison d'être en ${langue}`);
    }
  }
  const ids = JEU.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "identifiants dupliqués");
});

test("le jeu contient assez de cas négatifs pour ne pas récompenser un système qui dit oui à tout", () => {
  const negatifs = JEU.filter((c) => c.attendu === null).length;
  assert.ok(negatifs / JEU.length >= 0.3, `seulement ${negatifs} cas négatifs sur ${JEU.length}`);
});

test("le jeu ne laisse pas de français dans sa version anglaise", () => {
  const francais = /\b(cas|nom|pas|une|des|qui|sur|dans|correspondance|saisie)\b/i;
  for (const c of JEU) {
    assert.ok(!francais.test(c.pourquoi.en), `${c.id} : « ${c.pourquoi.en} »`);
  }
});
