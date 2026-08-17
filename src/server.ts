import { createServer, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { runs, load } from "./bench.ts";
import { compare } from "./diff.ts";
import { measureStability } from "./stability.ts";
import { runAll } from "./run.ts";
import { VERSIONS } from "./screening.ts";
import { CASES } from "./cases.ts";

const PORT = Number(process.env.PORT ?? 4600);

function json(res: ServerResponse, body: unknown, code = 200): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** Le jeu, indexé : l'écran doit pouvoir montrer l'entrée et le why d'un cases. */
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

// Un banc vide n'a rien à montrer : on lance les versions au démarrage.
if (runs().length === 0) await runAll();

/*
 * On écoute la boucle locale, pas toutes les interfaces.
 *
 * `listen(PORT)` seul fait écouter Node sur `::` — l'outil devient joignable par
 * n'importe qui sur le même réseau. Sur le wifi d'un café, ça expose un écran qui lit
 * des dossiers clients.
 */
serveur.listen(PORT, "127.0.0.1", () => {
  console.log(`Regression bench → http://localhost:${PORT}`);
});
