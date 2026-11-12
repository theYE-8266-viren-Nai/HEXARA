import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createIngestReceiver } from "./src/server/ingestReceiver";
import type { IngestRequest } from "./src/server/ingestReceiver";

// This config runs in Node, but the project has no Node type package; declare only what is used.
declare const process: { env: Record<string, string | undefined> };
declare const crypto: { randomUUID(): string };

const MAX_BODY_READ = 512 * 1024;

// The only members of Node's request/response used below.
interface NodeReq { url?: string; method?: string; headers: Record<string, string | string[] | undefined>; on(event: string, listener: (chunk?: unknown) => void): void }
interface NodeRes { statusCode: number; setHeader(name: string, value: string): void; end(body?: string): void }

/**
 * Local webhook receiver, development server only (apply: "serve"), so production builds never ship it.
 * All logic lives in the pure, tested src/server/ingestReceiver.ts; this is only the HTTP glue.
 */
function localIngestReceiver(): Plugin {
  return {
    name: "horizon-local-ingest",
    apply: "serve",
    configureServer(server) {
      const token = process.env.HORIZON_INGEST_TOKEN || (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      const receiver = createIngestReceiver({ token });
      server.config.logger.info("  Webhook receiver (local demo): POST /api/ingest. Token is shown in Profile > Webhook source.");
      server.middlewares.use((request, response, next) => {
        const req = request as unknown as NodeReq;
        const res = response as unknown as NodeRes;
        const url: string = req.url ?? "";
        if (!url.startsWith("/api/ingest")) return next();
        const send = (status: number, json: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(json));
        };
        const [path, queryString = ""] = url.split("?");
        const query: Record<string, string> = {};
        try {
          for (const pair of queryString.split("&")) { const [key, value = ""] = pair.split("="); if (key) query[decodeURIComponent(key)] = decodeURIComponent(value); }
        } catch { return send(400, { error: "Malformed query string." }); }
        const headers: Record<string, string | undefined> = {};
        for (const [name, value] of Object.entries(req.headers)) headers[name.toLowerCase()] = Array.isArray(value) ? value.join(",") : value;
        let body = ""; let tooLarge = false;
        req.on("data", (chunk) => { if (tooLarge) return; body += String(chunk); if (body.length > MAX_BODY_READ) { tooLarge = true; send(413, { error: "Body is too large." }); } });
        req.on("end", () => {
          if (tooLarge) return;
          const request: IngestRequest = { method: (req.method ?? "GET").toUpperCase(), path, query, headers, body };
          const result = receiver.handle(request);
          if (!result) return next();
          send(result.status, result.json);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localIngestReceiver()],
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"] },
});
