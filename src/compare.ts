import { load, runs } from "./bench.ts";
import { brancherDisque } from "./store.ts";
import { isMain } from "./cli.ts";
import { compare, summarise } from "./diff.ts";

/* Runs persist to disk when the bench is driven from Node; the browser build keeps
 * them in memory instead — see `bench.ts`. */
brancherDisque();

if (isMain(import.meta)) {
  const [beforeName, afterName] = process.argv.slice(2);

  if (!beforeName || !afterName) {
    const available = runs().map((e) => e.version);
    console.log("Usage : npm run compare -- <before> <after>");
    console.log(available.length ? `Runs on record: ${available.join(", ")}` : "No run on record — start with: npm run run-all");
    process.exit(1);
  }

  const before = load(beforeName), after = load(afterName);
  if (!before || !after) {
    console.error(`Run not found: ${!before ? beforeName : afterName}`);
    process.exit(1);
  }

  const c = compare(before, after);
  console.log("\n" + summarise(c) + "\n");

  // The exit code, so continuous integration can block on a regression. Without it the
  // report is a document nobody opens.
  process.exit(c.verdict === "regression" ? 1 : 0);
}
