/**
 * Le banc.
 *
 * Un système à évaluer est une simple fonction. Le banc ne sait rien de ce qu'il y a
 * dedans — un modèle, des règles, un appel réseau — et c'est voulu : dès qu'un banc
 * connaît son sujet, il ne sert qu'à lui.
 *
 * Ce qu'il enregistre n'est pas une note mais une **exécution** : le résultat de chaque
 * cas, un par un. Une note ne se compare pas ; une exécution, si. C'est toute la
 * différence entre « on est à 80 % » et « ces sept cas-là ne marchent plus ».
 */

import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";

const DOSSIER = new URL("../data/executions", import.meta.url).pathname;

/** Un texte dans les deux langues : le moteur ne produit jamais d'affichage. */
export type Bilingue = { fr: string; en: string };

export type Cas<E, S> = {
  id: string;
  /** À quoi sert ce cas. Un cas dont personne ne sait pourquoi il existe finit supprimé. */
  pourquoi: Bilingue;
  entree: E;
  attendu: S;
};

export type Resultat = {
  cas: string;
  reussi: boolean;
  obtenu: unknown;
  attendu: unknown;
  /** Millisecondes. Une régression de vitesse est une régression. */
  duree: number;
  erreur: string | null;
};

export type Execution = {
  /** Le nom de la version évaluée — pas un horodatage : on compare des versions. */
  version: string;
  le: string;
  resultats: Resultat[];
  reussis: number;
  total: number;
  taux: number;
  dureeTotale: number;
};

/** Comment on juge qu'une sortie est correcte. Par défaut, l'égalité stricte. */
export type Juge<S> = (obtenu: S, attendu: S) => boolean;

const egalite = <S,>(a: S, b: S) => JSON.stringify(a) === JSON.stringify(b);

export async function lancer<E, S>(
  version: string,
  systeme: (entree: E) => S | Promise<S>,
  cas: Cas<E, S>[],
  juge: Juge<S> = egalite,
): Promise<Execution> {
  const resultats: Resultat[] = [];

  for (const c of cas) {
    const debut = performance.now();
    try {
      const obtenu = await systeme(c.entree);
      resultats.push({
        cas: c.id, reussi: juge(obtenu, c.attendu), obtenu, attendu: c.attendu,
        duree: performance.now() - debut, erreur: null,
      });
    } catch (e) {
      // Une exception est un échec du cas, pas du banc. Un banc qui s'arrête au premier
      // plantage ne dit rien des cas suivants — et c'est souvent là qu'est l'information.
      resultats.push({
        cas: c.id, reussi: false, obtenu: null, attendu: c.attendu,
        duree: performance.now() - debut,
        erreur: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const reussis = resultats.filter((r) => r.reussi).length;
  return {
    version, le: new Date().toISOString(), resultats,
    reussis, total: resultats.length,
    taux: resultats.length === 0 ? 0 : reussis / resultats.length,
    dureeTotale: resultats.reduce((s, r) => s + r.duree, 0),
  };
}

const chemin = (version: string) =>
  `${DOSSIER}/${version.replace(/[^a-z0-9_.-]/gi, "_")}.json`;

export function enregistrer(execution: Execution): string {
  mkdirSync(DOSSIER, { recursive: true });
  const ou = chemin(execution.version);
  writeFileSync(ou, JSON.stringify(execution, null, 2));
  return ou;
}

export function relire(version: string): Execution | null {
  const ou = chemin(version);
  return existsSync(ou) ? JSON.parse(readFileSync(ou, "utf8")) : null;
}

export function executions(): Execution[] {
  if (!existsSync(DOSSIER)) return [];
  return readdirSync(DOSSIER)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`${DOSSIER}/${f}`, "utf8")) as Execution)
    .sort((a, b) => a.le.localeCompare(b.le));
}
