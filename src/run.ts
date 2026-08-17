/**
 * Lancer les trois versions et save chaque exécution.
 *
 * Les exécutions sont nommées par version, pas horodatées : on compare « v2 contre v3 »,
 * jamais « lundi contre mardi ». Un banc qui range par date pousse à regarder la
 * dernière colonne ; un banc qui range par version pousse à regarder la différence.
 */

import { run, save } from "./bench.ts";
import { VERSIONS } from "./screening.ts";
import { CASES } from "./cases.ts";

export async function runAll() {
  const faites = [];
  for (const [name, system] of Object.entries(VERSIONS)) {
    const e = await run(name, system, CASES);
    save(e);
    faites.push(e);
  }
  return faites;
}

if (import.meta.filename === process.argv[1]) {
  const faites = await runAll();
  console.log(`\n${CASES.length} check cases\n`);
  for (const e of faites) {
    const rates = e.results.filter((r) => !r.passed).map((r) => r.caseId);
    console.log(`${e.version.padEnd(18)} ${String(e.passed).padStart(2)}/${e.total}  ${(e.rate * 100).toFixed(1).padStart(5)} %`);
    if (rates.length > 0) console.log(`  fails on: ${rates.join(", ")}`);
  }
  console.log("\nCompare two versions:  npm run compare -- v2-normalise v3-approximatif\n");
}
