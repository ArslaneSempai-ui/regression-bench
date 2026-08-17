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

import { pairedVerdict } from "./interval.ts";
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
  /**
   * Can this case set tell the two versions apart by rate at all?
   *
   * Usually not, and that is the bench's whole argument. Judging by the rate here is
   * reading noise; the cases that broke are facts either way.
   */
  paired: ReturnType<typeof pairedVerdict>;
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
    paired: pairedVerdict(gains.length, regressions.length),
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
  const lines: string[] = [];

  if (c.verdict === "regression") {
    lines.push(`✗ ${c.regressions.length} regression(s) — ${c.before} -> ${c.after}`);
    for (const r of c.regressions) {
      lines.push(`    ${r.caseId}: expected ${JSON.stringify(r.after.expected)}, got ${JSON.stringify(r.after.actual)}`);
    }
    if (c.gains.length > 0) {
      lines.push(`  (${c.gains.length} gain(s) elsewhere — the rate moves ${pc(c.rateBefore)} -> ${pc(c.rateAfter)},`);
      lines.push(`   which does not buy back cases that had been validated once.)`);
    }
  } else if (c.verdict === "amelioration") {
    lines.push(`✓ ${c.gains.length} gain(s), no regression — ${pc(c.rateBefore)} -> ${pc(c.rateAfter)}`);
  } else if (c.verdict === "neutre") {
    lines.push(`= no verdict changed — ${pc(c.rateAfter)}`);
  } else {
    lines.push(`? no case in common between ${c.before} and ${c.after}: nothing to compare`);
  }

  /*
   * The rate is usually not the evidence, and saying so is the point of this bench.
   *
   * Two runs over the same cases are not independent samples. What can be tested is the
   * split of the cases that changed verdict, and on a handful of them it is rarely
   * distinguishable from a coin. The broken cases remain facts either way.
   */
  lines.push(`  ${c.paired.note}` +
    (c.paired.p !== undefined ? ` (${c.paired.discordant} discordant, p = ${c.paired.p.toFixed(3)})` : ""));

  if (c.silent.length > 0) {
    lines.push(`  ${c.silent.length} case(s) with an unchanged verdict but a different output`);
  }
  if (c.added.length > 0 || c.removed.length > 0) {
    lines.push(`  case set changed: ${c.added.length} added, ${c.removed.length} removed — partial comparison`);
  }

  const shiftMs = c.durationAfter - c.durationBefore;
  if (Math.abs(c.durationShift) > 0.25 && Math.abs(shiftMs) >= DURATION_NOISE_MS) {
    lines.push(`  duration ${shiftMs > 0 ? "+" : ""}${shiftMs.toFixed(0)} ms (${c.durationShift > 0 ? "+" : ""}${(c.durationShift * 100).toFixed(0)} %)`);
  }
  return lines.join("\n");
}
