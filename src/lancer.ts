/**
 * Lancer les trois versions et enregistrer chaque exécution.
 *
 * Les exécutions sont nommées par version, pas horodatées : on compare « v2 contre v3 »,
 * jamais « lundi contre mardi ». Un banc qui range par date pousse à regarder la
 * dernière colonne ; un banc qui range par version pousse à regarder la différence.
 */

import { lancer, enregistrer } from "./banc.ts";
import { VERSIONS } from "./criblage.ts";
import { JEU } from "./jeu.ts";

export async function toutLancer() {
  const faites = [];
  for (const [nom, systeme] of Object.entries(VERSIONS)) {
    const e = await lancer(nom, systeme, JEU);
    enregistrer(e);
    faites.push(e);
  }
  return faites;
}

if (import.meta.filename === process.argv[1]) {
  const faites = await toutLancer();
  console.log(`\n${JEU.length} cas de contrôle\n`);
  for (const e of faites) {
    const rates = e.resultats.filter((r) => !r.reussi).map((r) => r.cas);
    console.log(`${e.version.padEnd(18)} ${String(e.reussis).padStart(2)}/${e.total}  ${(e.taux * 100).toFixed(1).padStart(5)} %`);
    if (rates.length > 0) console.log(`  échoue sur : ${rates.join(", ")}`);
  }
  console.log("\nComparer deux versions :  npm run comparer -- v2-normalise v3-approximatif\n");
}
