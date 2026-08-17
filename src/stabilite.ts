/**
 * La stabilité : le même système, le même cas, plusieurs fois.
 *
 * Presque personne ne fait cette mesure, et c'est celle qui ruine le plus de bancs.
 * Un cas qui réussit sept fois sur dix n'est pas un cas qui réussit : c'est un cas dont
 * le verdict dépend du jour où on l'a lancé. Comparé à une exécution antérieure, il
 * produira des « régressions » et des « gains » qui n'ont aucun rapport avec le code —
 * et l'équipe apprendra à ignorer le banc.
 *
 * Sur un système déterministe, rien ne bouge. Dès qu'un modèle de langage, un ordre de
 * lecture ou un appel réseau entre dans la chaîne, cette mesure devient la première à
 * faire, avant toute comparaison de versions.
 */

import { lancer } from "./banc.ts";
import type { Cas, Juge } from "./banc.ts";
import { VERSIONS } from "./criblage.ts";
import { JEU } from "./jeu.ts";

export type Instable = {
  cas: string;
  reussites: number;
  tours: number;
  /** Les sorties distinctes observées. Deux valeurs = deux comportements. */
  sorties: string[];
};

export type Stabilite = {
  version: string;
  tours: number;
  instables: Instable[];
  /** Vrai si chaque cas a donné le même verdict à chaque tour. */
  stable: boolean;
};

export async function mesurerStabilite<E, S>(
  version: string,
  systeme: (entree: E) => S | Promise<S>,
  cas: Cas<E, S>[],
  tours = 5,
  juge?: Juge<S>,
): Promise<Stabilite> {
  const reussites = new Map<string, number>();
  const sorties = new Map<string, Set<string>>();

  for (let i = 0; i < tours; i++) {
    const e = await lancer(version, systeme, cas, juge);
    for (const r of e.resultats) {
      reussites.set(r.cas, (reussites.get(r.cas) ?? 0) + (r.reussi ? 1 : 0));
      if (!sorties.has(r.cas)) sorties.set(r.cas, new Set());
      sorties.get(r.cas)!.add(JSON.stringify(r.obtenu));
    }
  }

  const instables: Instable[] = [];
  for (const [id, n] of reussites) {
    // Instable = ni toujours réussi, ni toujours échoué.
    if (n !== 0 && n !== tours) {
      instables.push({ cas: id, reussites: n, tours, sorties: [...sorties.get(id)!] });
    }
  }

  return { version, tours, instables, stable: instables.length === 0 };
}

if (import.meta.filename === process.argv[1]) {
  const tours = Number(process.argv[2] ?? 5);
  console.log(`\nStabilité sur ${tours} tours — ${JEU.length} cas\n`);

  for (const [nom, systeme] of Object.entries(VERSIONS)) {
    const s = await mesurerStabilite(nom, systeme, JEU, tours);
    if (s.stable) {
      console.log(`${nom.padEnd(18)} stable`);
    } else {
      console.log(`${nom.padEnd(18)} ${s.instables.length} cas instable(s)`);
      for (const i of s.instables) {
        console.log(`    ${i.cas} : ${i.reussites}/${i.tours} — sorties observées : ${i.sorties.join(", ")}`);
      }
    }
  }
  console.log(
    "\nUn système déterministe doit être stable. S'il ne l'est pas, aucune comparaison" +
    "\nde versions n'a de sens : le banc mesurerait le hasard.\n",
  );
}
