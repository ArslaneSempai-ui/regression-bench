/**
 * The figures this README is allowed to state.
 *
 * Computed from the recorded runs rather than typed. The prose stays hand-written; only
 * the numbers are mechanical, and only the numbers were ever wrong.
 */

import { runs, load } from "./bench.ts";
import { runAll } from "./run.ts";
import { VERSIONS, DETERMINISTIC } from "./screening.ts";
import { compare } from "./diff.ts";
import { rate, writeRate } from "./interval.ts";
import { INVENTORY, CITED } from "./inventory.ts";
import { markdown } from "./provenance.ts";

import { run as emit, table } from "./figures.ts";

/*
 * Record the runs if none exist, rather than telling the reader to.
 *
 * A cold clone found this: `npm test` failed with "No run on record", because the check
 * needs recorded runs and `data/` is not versioned. Someone cloning the repository could
 * not run its tests — which is the whole of what reproducibility means.
 *
 * The runs are cheap and deterministic, so the check produces what it needs.
 */
if (runs().length === 0) await runAll();

/*
 * Ordered by declaration, not by when the file happened to be written.
 *
 * `runs()` sorts on the recorded timestamp, and four runs finishing inside the same
 * millisecond come back in whatever order the filesystem lists them. The table was
 * therefore reported stale after a plain re-run, with no code change at all. A figure
 * whose order depends on the clock is not reproducible.
 */
const ordre = Object.keys(VERSIONS);
const all = runs().slice().sort((a, b) => ordre.indexOf(a.version) - ordre.indexOf(b.version));

const WHAT = {
  "v1-exact": "literal string comparison",
  "v2-normalise": "case, accents, punctuation, word order",
  "v3-approximatif": "edit distance, for typos and transliterations",
  "v4-sous-budget": "v3 with a time budget, falling back to exact",
} as Record<string, string>;

/*
 * A rate from a non-deterministic version is not a figure, and must not be printed as one.
 *
 * Five cold runs of the check reported this table stale on four of them, with no code
 * change. The cause was `v4-sous-budget`, the time-budgeted version this bench exists to
 * flag: its pass rate moves between runs, and the README was publishing a fixed number
 * taken from the one version it calls non-deterministic.
 *
 * The first repair sampled each version for stability, which made the README build itself
 * flaky — five rounds can agree by luck. What is known by construction is declared.
 */
const versions = table(
  ["Version", "What changed", "Pass rate", "95 % interval"],
  all.map((r) => {
    const x = rate(r.passed, r.total);
    const stable = DETERMINISTIC[r.version as keyof typeof DETERMINISTIC] !== false;
    return [
      `\`${r.version}\``,
      WHAT[r.version] ?? "—",
      stable ? `${(x.rate * 100).toFixed(1)} %` : "**varies between runs**",
      stable ? `[${(x.low * 100).toFixed(0)}–${(x.high * 100).toFixed(0)}]` : "—",
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

/*
 * What a regression actually is, in the words of the regulation.
 *
 * Every other repository here cites the rule it applies; this one had nothing, because
 * nothing about running a test bench is a legal requirement. That was the wrong place to
 * look. The requirement is on the *system under test*: property blocked under a sanctions
 * programme is reported within ten business days, and a screener that stops matching a
 * name does not lower a score — it starts a clock nobody knows is running.
 */
const stakes = table(
  ["Citation", "Requires", "Figure", "Retrieved"],
  CITED.map((r) => [`[${r.cite}](${r.source})`, r.says, r.figure ?? "—", r.retrieved]),
);

/* Where every number on this page came from. Generated, and guarded by a test. */
const provenance = markdown(INVENTORY, table);

emit(new URL("../README.md", import.meta.url).pathname, { versions, verdict, stakes, provenance });
