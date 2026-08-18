/*
 * FIGER LA MESURE DE STABILITÉ.
 *
 * `v4-sous-budget` court après une horloge : c'est sa raison d'être dans ce banc. La
 * conséquence est qu'il n'existe aucun nombre de tours qui fige son verdict. Mesuré, plutôt
 * que supposé : sur huit cent tours répétés six fois, le taux de réussite de `faute-01`
 * est passé de 95,50 % à 99,88 %. Un taux fixe donnerait ±0,7 point d'écart-type à cette
 * taille d'échantillon ; ce n'est donc pas du bruit d'échantillonnage, c'est la charge de
 * la machine qui bouge sous la mesure. Multiplier les tours ne converge pas, ça déplace
 * seulement le moment où l'on regarde.
 *
 * Le dépôt avait déjà tiré cette leçon une fois — `DETERMINISTIC` déclare ce qui est connu
 * par construction, « parce que cinq tours d'accord peuvent être d'accord par chance ». Ce
 * fichier applique la même règle au reste : on mesure **une fois**, on écrit le résultat,
 * on l'étiquette avec sa date et son nombre de tours, et l'écran lit ça. La démo affiche
 * alors la même grille à chaque visite, et ce qu'elle affiche est une mesure datée plutôt
 * qu'un tirage du moment.
 *
 * Ce qu'on ne fait pas : vérifier automatiquement que la mesure est encore juste. Un
 * contrôle qui échantillonne un système instable est lui-même instable — c'est exactement
 * le défaut qui avait fait déclarer quatre builds de README périmés sans un changement de
 * code. La mise à jour est une décision, pas un test.
 */

import { writeFileSync } from "node:fs";
import { measureStability } from "./stability.ts";
import { VERSIONS } from "./screening.ts";
import { CASES } from "./cases.ts";
import { isMain, arg } from "./cli.ts";

const CIBLE = new URL("./reference-stabilite.ts", import.meta.url).pathname;

export async function figer(tours: number): Promise<string> {
  const versions: Record<string, Record<string, number>> = {};
  for (const [nom, systeme] of Object.entries(VERSIONS)) {
    versions[nom] = (await measureStability(nom, systeme, CASES, tours)).passesParCas;
  }
  return `/*
 * Mesuré une fois, pas rejoué à chaque visite. Régénérer avec \`npm run figer\`.
 *
 * Pourquoi ce fichier existe plutôt qu'une mesure au chargement : voir figer-stabilite.ts.
 * En deux mots — une des versions court après une horloge, donc son verdict dépend de la
 * charge de la machine et aucun nombre de tours ne le fige.
 */

/** Combien de tours chaque cas a réussi, par version. */
export const REFERENCE_STABILITE = ${JSON.stringify({ mesureLe: new Date().toISOString(), tours, versions }, null, 2)} as const;
`;
}

if (isMain(import.meta)) {
  const tours = Number(arg(2) ?? 400);
  writeFileSync(CIBLE, await figer(tours));
  console.log(`stabilité figée sur ${tours} tours → src/reference-stabilite.ts`);
}
