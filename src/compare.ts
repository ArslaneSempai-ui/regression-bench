import { load, runs } from "./bench.ts";
import { compare, summarise } from "./diff.ts";

if (import.meta.filename === process.argv[1]) {
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

  // Le code de output, pour qu'une intégration continue puisse bloquer sur une
  // régression. Sans ça, le rapport est un document que personne n'ouvre.
  process.exit(c.verdict === "regression" ? 1 : 0);
}
