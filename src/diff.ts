/**
 * Comparer deux exécutions.
 *
 * C'est la raison d'être du projet. Un rate qui monte n'est pas une bonne nouvelle en
 * soi : il peut monter en cassant des cas qui marchaient. Sur un système de conformité,
 * une modification qui gagne trois cas et en perd deux n'est pas « +1 » — c'est deux
 * comportements qu'on ne sait plus expliquer à quelqu'un qui les avait validés.
 *
 * Le verdict de ce fichier est donc volontairement sévère : **toute régression rend le
 * changement suspect, quelle que soit la moyenne.** Libre à un humain de passer outre,
 * mais en le sachant.
 */

import type { Run, Result } from "./bench.ts";

/** En deçà de cet écart absolu, une variation de durée est du bruit de mesure. */
export const DURATION_NOISE_MS = 5;

export type Movement = {
  caseId: string;
  before: Result;
  after: Result;
};

export type Comparison = {
  before: string;
  after: string;
  /** Case cassés par le changement. La seule liste qui compte vraiment. */
  regressions: Movement[];
  /** Case réparés par le changement. */
  gains: Movement[];
  /** Case dont le résultat est identique mais la output a changé. */
  silent: Movement[];
  /** Case présents d'un seul côté : le jeu a bougé, la comparaison est partielle. */
  added: string[];
  removed: string[];
  rateBefore: number;
  rateAfter: number;
  /** Écart de durée totale, en pourcentage — et en absolu, sans quoi il ment. */
  durationShift: number;
  durationBefore: number;
  durationAfter: number;
  verdict: "regression" | "amelioration" | "neutre" | "incomparable";
};

export function compare(before: Run, after: Run): Comparison {
  const parId = (e: Run) => new Map(e.results.map((r) => [r.caseId, r]));
  const a = parId(before), b = parId(after);

  const regressions: Movement[] = [];
  const gains: Movement[] = [];
  const silent: Movement[] = [];

  for (const [id, ra] of a) {
    const rb = b.get(id);
    if (!rb) continue;
    if (ra.passed && !rb.passed) regressions.push({ caseId: id, before: ra, after: rb });
    else if (!ra.passed && rb.passed) gains.push({ caseId: id, before: ra, after: rb });
    else if (JSON.stringify(ra.actual) !== JSON.stringify(rb.actual)) {
      // Même verdict, output différente. Souvent anodin, parfois le signe qu'un cas
      // passe pour de mauvaises raisons — et qu'il passera moins longtemps que prévu.
      silent.push({ caseId: id, before: ra, after: rb });
    }
  }

  const added = [...b.keys()].filter((id) => !a.has(id));
  const removed = [...a.keys()].filter((id) => !b.has(id));

  const communs = [...a.keys()].filter((id) => b.has(id)).length;
  const verdict: Comparison["verdict"] =
    communs === 0 ? "incomparable"
      : regressions.length > 0 ? "regression"
      : gains.length > 0 ? "amelioration"
      : "neutre";

  return {
    before: before.version, after: after.version,
    regressions, gains, silent, added, removed,
    rateBefore: before.rate, rateAfter: after.rate,
    durationShift: before.totalDuration === 0 ? 0
      : (after.totalDuration - before.totalDuration) / before.totalDuration,
    durationBefore: before.totalDuration,
    durationAfter: after.totalDuration,
    verdict,
  };
}

/**
 * La phrase qu'on veut voir dans une console d'intégration continue.
 *
 * Elle dit d'abord ce qui casse. Un rapport qui commence par le rate se lit comme un
 * bulletin de notes, et on n'en retient que le chiffre.
 */
export function summarise(c: Comparison): string {
  const pc = (x: number) => (x * 100).toFixed(1) + " %";
  const lignes: string[] = [];

  if (c.verdict === "regression") {
    lignes.push(`✗ ${c.regressions.length} régression(s) — ${c.before} → ${c.after}`);
    for (const r of c.regressions) {
      lignes.push(`    ${r.caseId} : expected ${JSON.stringify(r.after.expected)}, actual ${JSON.stringify(r.after.actual)}`);
    }
    if (c.gains.length > 0) {
      lignes.push(`  (${c.gains.length} gain(s) par ailleurs — le rate passe de ${pc(c.rateBefore)} à ${pc(c.rateAfter)},`);
      lignes.push(`   ce qui ne rachète pas les cas cassés : ils avaient été validés une fois.)`);
    }
  } else if (c.verdict === "amelioration") {
    lignes.push(`✓ ${c.gains.length} gain(s), aucune régression — ${pc(c.rateBefore)} → ${pc(c.rateAfter)}`);
  } else if (c.verdict === "neutre") {
    lignes.push(`= aucun changement de verdict — ${pc(c.rateAfter)}`);
  } else {
    lignes.push(`? aucun cas commun entre ${c.before} et ${c.after} : rien à compare`);
  }

  if (c.silent.length > 0) {
    lignes.push(`  ${c.silent.length} cas au verdict inchangé mais à la output différente`);
  }
  if (c.added.length > 0 || c.removed.length > 0) {
    lignes.push(`  jeu modifié : ${c.added.length} ajouté(s), ${c.removed.length} retiré(s) — comparaison partielle`);
  }
  /*
   * La durée ne se signale qu'en pourcentage ET en absolu.
   *
   * La première version annonçait « +1416 % » sur un écart de deux millisecondes. Un
   * pourcentage calculé sur une base minuscule est du bruit habillé en signal — le
   * défaut exact que ce projet reproche aux tableaux de bord.
   */
  const ecartMs = c.durationAfter - c.durationBefore;
  if (Math.abs(c.durationShift) > 0.25 && Math.abs(ecartMs) >= DURATION_NOISE_MS) {
    lignes.push(`  durée ${ecartMs > 0 ? "+" : ""}${ecartMs.toFixed(0)} ms (${c.durationShift > 0 ? "+" : ""}${(c.durationShift * 100).toFixed(0)} %)`);
  }
  return lignes.join("\n");
}
