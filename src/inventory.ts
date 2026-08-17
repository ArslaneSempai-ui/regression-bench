/**
 * Every number this bench puts on a page, and where it came from.
 *
 * This repository is the one whose central claim survives its own inventory intact, and it
 * is worth being precise about why. The finding is not a rate. It is that **two named
 * cases stopped working while the average went up** — and that is a fact about the runs, not
 * an estimate from them. It does not weaken when you learn the case set is 22 hand-written
 * names, because "these two cases regressed" is true of any 22 cases you like.
 *
 * The rates are the opposite. 81.8 % against 86.4 % on 22 cases is ±14 points of interval,
 * and the bench says so on the page rather than reporting the difference as progress. That
 * asymmetry — facts you can trust beside a rate you cannot — is the whole argument, and the
 * inventory below is what makes it checkable rather than asserted.
 */

import { CASES } from "./cases.ts";
import { VERSIONS, TOLERANCE, BUDGET_MS, WATCHLIST } from "./screening.ts";
import { ALL } from "./regulations.ts";
import type { Regulation } from "./regulations.ts";
import type { Inventory } from "./provenance.ts";

/** The section the system under test is held to — not everything the shared file holds. */
export const CITED: Regulation[] = ALL.filter((r) => /501\.603/.test(r.cite));

export const INVENTORY: Inventory = [
  ...CITED.map((r) => ({
    name: r.cite,
    provenance: "retrieved" as const,
    what: r.says,
    note: `retrieved ${r.retrieved}`,
  })),

  /* ── measured ── */
  {
    name: "regressions",
    provenance: "measured",
    what: "named cases that worked in one version and stopped in the next",
    note: "a fact about the runs, not an estimate from them — it does not need an interval",
  },
  {
    name: "gains",
    provenance: "measured",
    what: "cases that started working",
    note: "reported beside the regressions, never netted against them",
  },
  {
    name: "passRate",
    provenance: "measured",
    what: "share of cases a version gets right",
    note: `always with its 95 % interval: ${CASES.length} cases put roughly ±14 points around any of them`,
  },
  {
    name: "paired verdict",
    provenance: "measured",
    what: "whether the case set can distinguish two versions at all",
    note: "exact binomial on the discordant pairs; usually the answer is no, and it says so",
  },
  {
    name: "flakiness",
    provenance: "measured",
    what: "cases whose result changes between runs of the same version",
    note: "determinism is declared per version, because five agreeing rounds can agree by luck",
  },

  /* ── chosen ── */
  {
    name: "CASES",
    provenance: "chosen",
    what: `the ${CASES.length} screening cases, and the expected answer for each`,
    note: "hand-written to cover transliteration, word order, diacritics and short names",
  },
  {
    name: "WATCHLIST",
    provenance: "chosen",
    what: `the ${WATCHLIST.length} names screened against`,
    note: "invented; a real list is hundreds of thousands of entries and cannot be published",
  },
  {
    name: "TOLERANCE",
    provenance: "chosen",
    what: "edit distance allowed, as a fraction of name length",
    note: "15 % — the value that makes v3 buy typos and pay with two distinct people",
  },
  {
    name: "BUDGET_MS",
    provenance: "chosen",
    what: `the ${BUDGET_MS} ms per-name budget v4 falls back under`,
    note: "chosen small enough that the fallback fires sometimes and not always — which is the point of v4",
  },
  {
    name: "VERSIONS",
    provenance: "chosen",
    what: `the ${Object.keys(VERSIONS).length} versions of the screener under test`,
    note: "each is a change any engineer would defend, which is why the arc is worth showing",
  },
];

export const MUST_DECLARE = {
  versions: Object.keys(VERSIONS),
  regulations: CITED.map((r) => r.cite),
};
