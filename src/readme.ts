/**
 * The figures this README is allowed to state.
 *
 * Computed from the recorded runs rather than typed. The prose stays hand-written; only
 * the numbers are mechanical, and only the numbers were ever wrong.
 */

import { runs, load } from "./bench.ts";
import { compare } from "./diff.ts";
import { rate, writeRate } from "./interval.ts";
import { run as emit, table } from "./figures.ts";

const all = runs();
if (all.length === 0) {
  console.error("No run on record — start with: npm run run-all");
  process.exit(1);
}

const WHAT = {
  "v1-exact": "literal string comparison",
  "v2-normalise": "case, accents, punctuation, word order",
  "v3-approximatif": "edit distance, for typos and transliterations",
  "v4-sous-budget": "v3 with a time budget, falling back to exact",
} as Record<string, string>;

const versions = table(
  ["Version", "What changed", "Pass rate", "95 % interval"],
  all.map((r) => {
    const x = rate(r.passed, r.total);
    return [
      `\`${r.version}\``,
      WHAT[r.version] ?? "—",
      `${(x.rate * 100).toFixed(1)} %`,
      `[${(x.low * 100).toFixed(0)}–${(x.high * 100).toFixed(0)}]`,
    ];
  }),
);

const before = load("v2-normalise"), after = load("v3-approximatif");
const c = before && after ? compare(before, after) : null;

const verdict = c
  ? `\`\`\`
✗ ${c.regressions.length} regression(s) — ${c.before} -> ${c.after}
${c.regressions.map((r) => `    ${r.caseId}: expected ${JSON.stringify(r.after.expected)}, got ${JSON.stringify(r.after.actual)}`).join("\n")}
  (${c.gains.length} gain(s) elsewhere — the rate moves ${(c.rateBefore * 100).toFixed(1)} % -> ${(c.rateAfter * 100).toFixed(1)} %,
   which does not buy back cases that had been validated once.)
  ${c.paired.note}${c.paired.p !== undefined ? ` (${c.paired.discordant} discordant, p = ${c.paired.p.toFixed(3)})` : ""}
\`\`\`

Every rate on this page carries its interval because ${all[0].total} cases put roughly
±${rate(Math.round(all[0].total * 0.85), all[0].total).precision.toFixed(0)} points around any of them. \
${writeRate(rate(before!.passed, before!.total))} against ${writeRate(rate(after!.passed, after!.total))} \
is not a difference this set can establish.`
  : "";

emit(new URL("../README.md", import.meta.url).pathname, { versions, verdict });
