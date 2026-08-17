import { relire, executions } from "./banc.ts";
import { comparer, resume } from "./diff.ts";

if (import.meta.filename === process.argv[1]) {
  const [avantNom, apresNom] = process.argv.slice(2);

  if (!avantNom || !apresNom) {
    const dispo = executions().map((e) => e.version);
    console.log("Usage : npm run comparer -- <avant> <apres>");
    console.log(dispo.length ? `Versions enregistrées : ${dispo.join(", ")}` : "Aucune exécution — lance d'abord : npm run lancer");
    process.exit(1);
  }

  const avant = relire(avantNom), apres = relire(apresNom);
  if (!avant || !apres) {
    console.error(`Exécution introuvable : ${!avant ? avantNom : apresNom}`);
    process.exit(1);
  }

  const c = comparer(avant, apres);
  console.log("\n" + resume(c) + "\n");

  // Le code de sortie, pour qu'une intégration continue puisse bloquer sur une
  // régression. Sans ça, le rapport est un document que personne n'ouvre.
  process.exit(c.verdict === "regression" ? 1 : 0);
}
