/**
 * Stability: the same system, the same cases, several times over.
 *
 * Presque personne ne fait cette mesure, et c'est celle qui ruine le plus de bancs.
 * A case that passes seven times out of ten is not a passing case: it is a case whose
 * verdict depends on the day you ran it. Compared against an earlier run it will produce
 * "regressions" and "gains" that have nothing to do with the code — and the team will
 * learn to ignore the bench.
 *
 * On a deterministic system nothing moves. The moment a language model, a read order or a
 * network call enters the chain, this measurement becomes the first one to
 * faire, before toute comparaison de versions.
 */

import { run } from "./bench.ts";
import { isMain, arg } from "./cli.ts";
import type { Case, Judge } from "./bench.ts";
import { VERSIONS } from "./screening.ts";
import { CASES } from "./cases.ts";

export type Unstable = {
  caseId: string;
  passes: number;
  rounds: number;
  /** The distinct outputs observed. Two values means two behaviours. */
  outputs: string[];
};

export type Stability = {
  version: string;
  rounds: number;
  unstable: Unstable[];
  /** True if every case gave the same verdict on every round. */
  stable: boolean;
  /**
   * Combien de tours chaque cas a réussi, tous les cas et pas seulement les instables.
   *
   * Sans ça, un écran qui veut dessiner la grille des cas doit prendre l'état de passage
   * dans une *autre* exécution — et sur une version instable les deux échantillons se
   * contredisent : la case est rouge « cassé par cette version » alors que la mesure de
   * stabilité, à côté, vient de la juger stable. Un même dessin ne peut pas venir de deux
   * tirages.
   */
  passesParCas: Record<string, number>;
};

export async function measureStability<E, S>(
  version: string,
  system: (input: E) => S | Promise<S>,
  cases: Case<E, S>[],
  rounds = 5,
  judge?: Judge<S>,
): Promise<Stability> {
  const passes = new Map<string, number>();
  const outputs = new Map<string, Set<string>>();

  for (let i = 0; i < rounds; i++) {
    const e = await run(version, system, cases, judge);
    for (const r of e.results) {
      passes.set(r.caseId, (passes.get(r.caseId) ?? 0) + (r.passed ? 1 : 0));
      if (!outputs.has(r.caseId)) outputs.set(r.caseId, new Set());
      outputs.get(r.caseId)!.add(JSON.stringify(r.actual));
    }
  }

  const unstable: Unstable[] = [];
  for (const [id, n] of passes) {
    // Unstable = neither always passing nor always failing.
    if (n !== 0 && n !== rounds) {
      unstable.push({ caseId: id, passes: n, rounds, outputs: [...outputs.get(id)!] });
    }
  }

  return {
    version, rounds, unstable, stable: unstable.length === 0,
    passesParCas: Object.fromEntries(passes),
  };
}

if (isMain(import.meta)) {
  const rounds = Number(arg(2) ?? 5);
  console.log(`\nStability over ${rounds} rounds — ${CASES.length} cases\n`);

  for (const [name, system] of Object.entries(VERSIONS)) {
    const s = await measureStability(name, system, CASES, rounds);
    if (s.stable) {
      console.log(`${name.padEnd(18)} stable`);
    } else {
      console.log(`${name.padEnd(18)} ${s.unstable.length} unstable case(s)`);
      for (const u of s.unstable) {
        console.log(`    ${u.caseId} : ${u.passes}/${u.rounds} — outputs seen: ${u.outputs.join(", ")}`);
      }
    }
  }
  console.log(
    "\nA deterministic system must be stable. If it is not, no comparison of versions" +
    "\nmeans anything: the bench would be measuring chance.\n",
  );
}
