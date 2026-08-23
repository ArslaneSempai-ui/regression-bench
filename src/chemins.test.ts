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
 * THIS FILE IS TEMPORARY, AND HERE IS WHAT DECIDES WHEN IT GOES.
 *
 * The shared layer now carries its own `.pathname` guard, in `gardiens.test.mjs`, which
 * arrives with the modules it protects — the right answer, and better than this file in one
 * respect: it strips TEMPLATE LITERALS before looking, which this one does not. That blind
 * spot is not hypothetical. A mass conversion put an `import` inside a template literal in
 * this very repository today, because the pattern recognised a line that LOOKED like an
 * import inside a string that holds browser code.
 *
 * But the travelling guard is narrower on the pattern, measured:
 *
 *   new URL("./a.ts", import.meta.url).pathname   both catch it
 *   new URL(urlDuFichier).pathname                only this file catches it
 *   new URL(base + nom).pathname                  only this file catches it
 *   url.pathname === "/"                          neither fires — correct
 *
 * So neither subsumes the other, and two guards for one rule is the shape we spend the day
 * removing. **This file goes the moment the shared one takes the broader pattern** — that
 * has been reported rather than fixed here, because a guard that lives in the layer must be
 * changed in the layer, not in eleven copies.
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
 * THE EXEMPTION IS GONE, AND IT ANNOUNCED ITS OWN REMOVAL.
 *
 * Four files were exempted here: `demo.test.ts`, `ecran.test.ts`, `liaison.test.ts` and
 * `registre.test.ts`, shared verbatim with `identite`, their canonical source outside this
 * repository. Correcting them here would have made `les couches partagées` fail by
 * construction. The exemption carried an assertion that the exempted count stayed non-zero
 * — so that it could not quietly become an exemption that exempts nothing.
 *
 * `identite` fixed them, the layer was recopied, and that assertion fired within the hour
 * with the message telling the reader to drop the list. **A declared exclusion is the only
 * kind that can tell you when it has expired.** A silent one would still be here.
 */

const sansCommentairesNiChaines = (t: string): string => t
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length))
  .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => " ".repeat(m.length));

test("no file uses `.pathname` on a file URL", () => {
  const fautifs: string[] = [];
  let examines = 0;

  for (const f of readdirSync(ICI)) {
    if (!/\.(ts|mjs|js)$/.test(f)) continue;
    examines++;
    sansCommentairesNiChaines(readFileSync(ICI + f, "utf8")).split("\n").forEach((l, i) => {
      if (!/new URL\([^)]*\)\s*\.pathname/.test(l)) return;
      fautifs.push(`${f}:${i + 1}  ${l.trim().slice(0, 80)}`);
    });
  }

  /*
   * PROVE THE SWEEP LOOKED. A guard in this repository caught this one: a test that walks a
   * directory and asserts an empty result passes just as well when the walk found nothing —
   * a wrong path, a renamed folder, a filter that stopped matching. **An unproven zero reads
   * exactly like a success**, which is the fault this whole catalogue is about, committed
   * inside a tool written to watch for it.
   */
  assert.ok(examines >= 5,
    `only ${examines} source file(s) examined in ${ICI}: the sweep is not looking where it `
    + "thinks it is, and its empty result means nothing.");

  assert.deepEqual(fautifs, [],
    "`.pathname` keeps the percent-encoding: use `fileURLToPath(new URL(...))`.\n  "
    + fautifs.join("\n  "));
});
