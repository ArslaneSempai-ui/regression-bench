/**
 * La stabilité : le même système, le même cases, plusieurs fois.
 *
 * Presque personne ne fait cette mesure, et c'est celle qui ruine le plus de bancs.
 * Un cas qui réussit sept fois sur dix n'est pas un cas qui réussit : c'est un cas dont
 * le verdict dépend du jour où on l'a lancé. Comparé à une exécution antérieure, il
 * produira des « régressions » et des « gains » qui n'ont aucun rapport avec le code —
 * et l'équipe apprendra à ignorer le banc.
 *
 * Sur un système déterministe, rien ne bouge. Dès qu'un modèle de langage, un ordre de
 * lecture ou un appel réseau entre dans la chaîne, cette mesure devient la première à
 * faire, before toute comparaison de versions.
 */

import { run } from "./bench.ts";
import type { Case, Judge } from "./bench.ts";
import { VERSIONS } from "./screening.ts";
import { CASES } from "./cases.ts";

export type Unstable = {
  caseId: string;
  passes: number;
  rounds: number;
  /** Les outputs distinctes observées. Deux valeurs = deux comportements. */
  outputs: string[];
};

export type Stability = {
  version: string;
  rounds: number;
  unstable: Unstable[];
  /** Vrai si chaque cas a donné le même verdict à chaque tour. */
  stable: boolean;
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
    // Unstable = ni toujours réussi, ni toujours échoué.
    if (n !== 0 && n !== rounds) {
      unstable.push({ caseId: id, passes: n, rounds, outputs: [...outputs.get(id)!] });
    }
  }

  return { version, rounds, unstable, stable: unstable.length === 0 };
}

if (import.meta.filename === process.argv[1]) {
  const rounds = Number(process.argv[2] ?? 5);
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
