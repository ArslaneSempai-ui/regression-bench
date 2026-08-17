/**
 * Run every version and save each run.
 *
 * Runs are named by version, not timestamped: what gets compared is "v2 against v3", never
 * "Monday against Tuesday". A bench ordered by date pushes you to look at the last column;
 * a bench ordered by version pushes you to look at the difference.
 */

import { run, save } from "./bench.ts";
import { brancherDisque } from "./store.ts";
import { isMain } from "./cli.ts";
import { VERSIONS } from "./screening.ts";
import { CASES } from "./cases.ts";

/* Runs persist to disk when the bench is driven from Node; the browser build keeps
 * them in memory instead — see `bench.ts`. */
brancherDisque();

export async function runAll() {
  const faites = [];
  for (const [name, system] of Object.entries(VERSIONS)) {
    const e = await run(name, system, CASES);
    save(e);
    faites.push(e);
  }
  return faites;
}

if (isMain(import.meta)) {
  const faites = await runAll();
  console.log(`\n${CASES.length} check cases\n`);
  for (const e of faites) {
    const rates = e.results.filter((r) => !r.passed).map((r) => r.caseId);
    console.log(`${e.version.padEnd(18)} ${String(e.passed).padStart(2)}/${e.total}  ${(e.rate * 100).toFixed(1).padStart(5)} %`);
    if (rates.length > 0) console.log(`  fails on: ${rates.join(", ")}`);
  }
  console.log("\nCompare two versions:  npm run compare -- v2-normalise v3-approximatif\n");
}
