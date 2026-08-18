import { createServer, type ServerResponse } from "node:http";
import { brancherDisque } from "./store.ts";
import { readFileSync } from "node:fs";
import { runs, load } from "./bench.ts";
import { compare } from "./diff.ts";
import { measureStability } from "./stability.ts";
import { runAll } from "./run.ts";
import { VERSIONS } from "./screening.ts";
import { CASES } from "./cases.ts";

/* Runs persist to disk when the bench is driven from Node; the browser build keeps
 * them in memory instead — see `bench.ts`. */
brancherDisque();

const PORT = Number(process.env.PORT ?? 4600);

function json(res: ServerResponse, body: unknown, code = 200): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** The set, indexed: the screen has to be able to show a case's input and its reason. */
const byCase = Object.fromEntries(CASES.map((c) => [c.id, { input: c.input, why: c.why }]));

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  try {
    if (url.pathname === "/") {
      const html = readFileSync(new URL("./ui.html", import.meta.url).pathname, "utf8");
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, must-revalidate",
      });
      res.end(html);
      return;
    }

    if (url.pathname === "/graphes.js") {
      const js = readFileSync(new URL("./graphes.js", import.meta.url).pathname, "utf8");
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      res.end(js);
      return;
    }

    if (url.pathname === "/registre.css") {
      const css = readFileSync(new URL("./registre.css", import.meta.url).pathname, "utf8");
      res.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" });
      res.end(css);
      return;
    }

    if (url.pathname === "/api/state") {
      return json(res, {
        runs: runs().map((e) => ({
          version: e.version, le: e.le, passed: e.passed, total: e.total, rate: e.rate,
        })),
        cases: byCase,
        totalCases: CASES.length,
        /*
         * Le résultat de chaque cas, version par version.
         *
         * La thèse de cet outil est qu'un taux qui monte peut cacher un cas qui vient de
         * casser — et jusqu'ici il l'affichait sous forme de taux, en demandant au lecteur
         * de cliquer « comparer » et de lire une liste pour trouver la casse. Les taux ne
         * suffisent pas à la dessiner : il faut les cas eux-mêmes. Vingt-deux booléens par
         * version, c'est le prix de la démonstration.
         */
        grille: {
          cas: CASES.map((c) => c.id),
          versions: runs().map((e) => ({
            version: e.version,
            passes: CASES.map((c) => e.results.find((r) => r.caseId === c.id)?.passed ?? null),
          })),
        },
      });
    }

    if (url.pathname === "/api/run" && req.method === "POST") {
      await runAll();
      return json(res, { runs: runs().map((e) => ({
        version: e.version, le: e.le, passed: e.passed, total: e.total, rate: e.rate,
      })) });
    }

    if (url.pathname === "/api/compare") {
      const a = load(url.searchParams.get("before") ?? "");
      const b = load(url.searchParams.get("after") ?? "");
      if (!a || !b) return json(res, { error: "execution_introuvable" }, 404);
      return json(res, compare(a, b));
    }

    if (url.pathname === "/api/stability" && req.method === "POST") {
      const runs = Number(url.searchParams.get("runs") ?? 8);
      const toutes = [];
      for (const [name, system] of Object.entries(VERSIONS)) {
        toutes.push(await measureStability(name, system, CASES, runs));
      }
      return json(res, { runs, versions: toutes });
    }

    res.writeHead(404).end("introuvable");
  } catch (error) {
    json(res, { error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// An empty bench has nothing to show, so the versions run at startup.
if (runs().length === 0) await runAll();

/*
 * Bind the loopback interface, not every interface.
 *
 * `listen(PORT)` on its own has Node listen on `::` — the tool becomes reachable by
 * anyone on the same network. On a café wifi that exposes a screen which reads
 * des dossiers clients.
 */
serveur.listen(PORT, "127.0.0.1", () => {
  console.log(`Regression bench → http://localhost:${PORT}`);
});
