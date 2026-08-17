/**
 * Comparer deux exécutions.
 *
 * C'est la raison d'être du projet. Un taux qui monte n'est pas une bonne nouvelle en
 * soi : il peut monter en cassant des cas qui marchaient. Sur un système de conformité,
 * une modification qui gagne trois cas et en perd deux n'est pas « +1 » — c'est deux
 * comportements qu'on ne sait plus expliquer à quelqu'un qui les avait validés.
 *
 * Le verdict de ce fichier est donc volontairement sévère : **toute régression rend le
 * changement suspect, quelle que soit la moyenne.** Libre à un humain de passer outre,
 * mais en le sachant.
 */

import type { Execution, Resultat } from "./banc.ts";

/** En deçà de cet écart absolu, une variation de durée est du bruit de mesure. */
export const SEUIL_DUREE_MS = 5;

export type Mouvement = {
  cas: string;
  avant: Resultat;
  apres: Resultat;
};

export type Comparaison = {
  avant: string;
  apres: string;
  /** Cas cassés par le changement. La seule liste qui compte vraiment. */
  regressions: Mouvement[];
  /** Cas réparés par le changement. */
  gains: Mouvement[];
  /** Cas dont le résultat est identique mais la sortie a changé. */
  silencieux: Mouvement[];
  /** Cas présents d'un seul côté : le jeu a bougé, la comparaison est partielle. */
  ajoutes: string[];
  retires: string[];
  tauxAvant: number;
  tauxApres: number;
  /** Écart de durée totale, en pourcentage — et en absolu, sans quoi il ment. */
  ecartDuree: number;
  dureeAvant: number;
  dureeApres: number;
  verdict: "regression" | "amelioration" | "neutre" | "incomparable";
};

export function comparer(avant: Execution, apres: Execution): Comparaison {
  const parId = (e: Execution) => new Map(e.resultats.map((r) => [r.cas, r]));
  const a = parId(avant), b = parId(apres);

  const regressions: Mouvement[] = [];
  const gains: Mouvement[] = [];
  const silencieux: Mouvement[] = [];

  for (const [id, ra] of a) {
    const rb = b.get(id);
    if (!rb) continue;
    if (ra.reussi && !rb.reussi) regressions.push({ cas: id, avant: ra, apres: rb });
    else if (!ra.reussi && rb.reussi) gains.push({ cas: id, avant: ra, apres: rb });
    else if (JSON.stringify(ra.obtenu) !== JSON.stringify(rb.obtenu)) {
      // Même verdict, sortie différente. Souvent anodin, parfois le signe qu'un cas
      // passe pour de mauvaises raisons — et qu'il passera moins longtemps que prévu.
      silencieux.push({ cas: id, avant: ra, apres: rb });
    }
  }

  const ajoutes = [...b.keys()].filter((id) => !a.has(id));
  const retires = [...a.keys()].filter((id) => !b.has(id));

  const communs = [...a.keys()].filter((id) => b.has(id)).length;
  const verdict: Comparaison["verdict"] =
    communs === 0 ? "incomparable"
      : regressions.length > 0 ? "regression"
      : gains.length > 0 ? "amelioration"
      : "neutre";

  return {
    avant: avant.version, apres: apres.version,
    regressions, gains, silencieux, ajoutes, retires,
    tauxAvant: avant.taux, tauxApres: apres.taux,
    ecartDuree: avant.dureeTotale === 0 ? 0
      : (apres.dureeTotale - avant.dureeTotale) / avant.dureeTotale,
    dureeAvant: avant.dureeTotale,
    dureeApres: apres.dureeTotale,
    verdict,
  };
}

/**
 * La phrase qu'on veut voir dans une console d'intégration continue.
 *
 * Elle dit d'abord ce qui casse. Un rapport qui commence par le taux se lit comme un
 * bulletin de notes, et on n'en retient que le chiffre.
 */
export function resume(c: Comparaison): string {
  const pc = (x: number) => (x * 100).toFixed(1) + " %";
  const lignes: string[] = [];

  if (c.verdict === "regression") {
    lignes.push(`✗ ${c.regressions.length} régression(s) — ${c.avant} → ${c.apres}`);
    for (const r of c.regressions) {
      lignes.push(`    ${r.cas} : attendu ${JSON.stringify(r.apres.attendu)}, obtenu ${JSON.stringify(r.apres.obtenu)}`);
    }
    if (c.gains.length > 0) {
      lignes.push(`  (${c.gains.length} gain(s) par ailleurs — le taux passe de ${pc(c.tauxAvant)} à ${pc(c.tauxApres)},`);
      lignes.push(`   ce qui ne rachète pas les cas cassés : ils avaient été validés une fois.)`);
    }
  } else if (c.verdict === "amelioration") {
    lignes.push(`✓ ${c.gains.length} gain(s), aucune régression — ${pc(c.tauxAvant)} → ${pc(c.tauxApres)}`);
  } else if (c.verdict === "neutre") {
    lignes.push(`= aucun changement de verdict — ${pc(c.tauxApres)}`);
  } else {
    lignes.push(`? aucun cas commun entre ${c.avant} et ${c.apres} : rien à comparer`);
  }

  if (c.silencieux.length > 0) {
    lignes.push(`  ${c.silencieux.length} cas au verdict inchangé mais à la sortie différente`);
  }
  if (c.ajoutes.length > 0 || c.retires.length > 0) {
    lignes.push(`  jeu modifié : ${c.ajoutes.length} ajouté(s), ${c.retires.length} retiré(s) — comparaison partielle`);
  }
  /*
   * La durée ne se signale qu'en pourcentage ET en absolu.
   *
   * La première version annonçait « +1416 % » sur un écart de deux millisecondes. Un
   * pourcentage calculé sur une base minuscule est du bruit habillé en signal — le
   * défaut exact que ce projet reproche aux tableaux de bord.
   */
  const ecartMs = c.dureeApres - c.dureeAvant;
  if (Math.abs(c.ecartDuree) > 0.25 && Math.abs(ecartMs) >= SEUIL_DUREE_MS) {
    lignes.push(`  durée ${ecartMs > 0 ? "+" : ""}${ecartMs.toFixed(0)} ms (${c.ecartDuree > 0 ? "+" : ""}${(c.ecartDuree * 100).toFixed(0)} %)`);
  }
  return lignes.join("\n");
}
