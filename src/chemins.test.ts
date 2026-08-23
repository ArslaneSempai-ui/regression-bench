/**
 * `.pathname` ON A FILE URL, NEVER AGAIN.
 *
 * `new URL(f, import.meta.url).pathname` keeps the percent-encoding: on any checkout whose
 * directory name holds a space or an accent, `readFileSync` receives `%20` and fails.
 * Fourteen of these were still in this repository today.
 *
 * WHY THIS TEST IS ITS OWN FILE. The sibling repository wrote this guard and **it did not
 * travel with the modules it protects.** The four shared layers are kept byte-identical
 * across repositories; the tests that defend them are not. A shared module without its
 * shared guard is half a mechanism — so this one is put where it can be copied whole,
 * rather than appended to a file that must stay identical to its canonical source.
 *
 * MENTIONS ARE NOT USES. This rule fired on its own comment at the first attempt, which is
 * the fault this catalogue describes as its most frequent: committed inside the tool that
 * watches for it. Comments and strings are stripped before looking, PRESERVING LINE COUNT —
 * a block crushed into a single space shifts every number below it, and the report then
 * points at an innocent line, which is how a correct rule gets ignored as a false one.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ICI = fileURLToPath(new URL(".", import.meta.url));

/*
 * DECLARED EXCLUSION, because a count that hides what it drops is not a count.
 *
 * These four are shared verbatim with `identite`, their canonical source, which is outside
 * this repository. They still carry the pattern. Fixing them here would make the
 * `les couches partagées` test fail by construction: the repository would be correct and
 * inconsistent at the same time. They are named, and the count is asserted, so that the
 * exemption is visible and cannot quietly become an exemption that exempts nothing.
 *
 * liste-figee: les quatre fichiers partages verbatim avec `identite`, leur source
 * canonique, hors de ce depot. Ils portent encore le motif ; les corriger ici ferait
 * echouer `les couches partagees` par construction. La liste ne se deduit pas du disque
 * parce que c'est une decision de propriete, pas une propriete du disque.
 */
const PARTAGES_AVEC_IDENTITE = ["demo.test.ts", "ecran.test.ts", "liaison.test.ts", "registre.test.ts"];

const sansCommentairesNiChaines = (t: string): string => t
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length))
  .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => " ".repeat(m.length));

test("no file uses `.pathname` on a file URL", () => {
  const fautifs: string[] = [];
  let exemptes = 0;

  for (const f of readdirSync(ICI)) {
    if (!/\.(ts|mjs|js)$/.test(f)) continue;
    sansCommentairesNiChaines(readFileSync(ICI + f, "utf8")).split("\n").forEach((l, i) => {
      if (!/new URL\([^)]*\)\s*\.pathname/.test(l)) return;
      if (PARTAGES_AVEC_IDENTITE.includes(f)) { exemptes++; return; }
      fautifs.push(`${f}:${i + 1}  ${l.trim().slice(0, 80)}`);
    });
  }

  assert.deepEqual(fautifs, [],
    "`.pathname` keeps the percent-encoding: use `fileURLToPath(new URL(...))`.\n  "
    + fautifs.join("\n  "));

  assert.ok(exemptes > 0,
    "the four files shared with `identite` no longer carry the pattern — drop the exclusion "
    + "list rather than keeping an exemption that exempts nothing.");
});
