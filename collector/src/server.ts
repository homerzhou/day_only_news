import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { Briefing, CandidatePool, Library, PreferenceState } from "../../mobile/src/shared/types.ts";

const OUTPUT = path.resolve(import.meta.dirname, "../output");
const PORT = 8787;

function readJsonDir<T>(folder: string): T[] {
  const dir = path.join(OUTPUT, folder);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as T);
}

function library(): Library {
  const briefings = readJsonDir<Briefing>("briefings");
  const frozenDates = new Set(briefings.filter((item) => item.frozen).map((item) => item.date));
  const candidates = readJsonDir<CandidatePool>("candidates").filter((item) => !frozenDates.has(item.date));
  return { briefings, candidates };
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

export function serve() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const server = http.createServer((req, res) => {
    if (!req.url || !req.method) return send(res, 400, { error: "bad request" });
    if (req.method === "OPTIONS") return send(res, 204, {});
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/api/health")) {
      if (url.pathname === "/") {
        const data = library();
        const html = `<!doctype html><meta charset="utf-8"><title>日简数据服务</title><body style="font-family:sans-serif;padding:24px;line-height:1.6"><h1>这是数据服务，不是简报界面</h1><p>看界面请打开 <a href="http://127.0.0.1:8081/">http://127.0.0.1:8081/</a>。在浏览器开发者工具里把尺寸改成 iPhone。</p><p>本页只给手机同步简报。已有定稿 ${data.briefings.length} 份，未定稿候选 ${data.candidates.length} 份。</p><p><a href="/api/library">查看 JSON</a></p></body>`;
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      return send(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/library") return send(res, 200, library());
    if (req.method === "POST" && url.pathname === "/api/preferences") {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        try {
          const prefs = JSON.parse(Buffer.concat(chunks).toString("utf8")) as PreferenceState;
          fs.writeFileSync(path.join(OUTPUT, "preferences.json"), JSON.stringify(prefs, null, 2), "utf8");
          send(res, 200, { ok: true });
        } catch {
          send(res, 400, { error: "invalid json" });
        }
      });
      return;
    }
    send(res, 404, { error: "not found" });
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`本机 http://127.0.0.1:${PORT}`);
    for (const address of lanAddresses()) console.log(`局域网 http://${address}:${PORT}`);
  });
}

function lanAddresses(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses.sort((a, b) => Number(b.startsWith("10.")) - Number(a.startsWith("10.")));
}
