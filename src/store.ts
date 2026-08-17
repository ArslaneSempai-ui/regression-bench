/**
 * The on-disk run store.
 *
 * Split out of `bench.ts` so the bench itself carries no filesystem dependency and can be
 * loaded in a browser. One file per version, named by version rather than timestamped —
 * what gets compared is "v2 against v3", never "Monday against Tuesday".
 */

import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { brancherStore } from "./bench.ts";
import type { Run } from "./bench.ts";

const DIRECTORY = new URL("../data/runs", import.meta.url).pathname;

const pathFor = (version: string) =>
  `${DIRECTORY}/${version.replace(/[^a-z0-9_.-]/gi, "_")}.json`;

export function brancherDisque(): void {
  brancherStore({
    read(version) {
      const ou = pathFor(version);
      return existsSync(ou) ? (JSON.parse(readFileSync(ou, "utf8")) as Run) : null;
    },
    write(execution) {
      mkdirSync(DIRECTORY, { recursive: true });
      writeFileSync(pathFor(execution.version), JSON.stringify(execution, null, 2));
    },
    all() {
      if (!existsSync(DIRECTORY)) return [];
      return readdirSync(DIRECTORY)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(readFileSync(`${DIRECTORY}/${f}`, "utf8")) as Run)
        .sort((a, b) => a.le.localeCompare(b.le));
    },
  });
}
