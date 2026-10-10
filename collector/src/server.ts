import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { Library, PreferenceState } from "../../mobile/src/shared/types.ts";
import { EMPTY_PREFS } from "../../mobile/src/shared/types.ts";

const OUTPUT = path.resolve(import.meta.dirname, "../output");
const BUNDLED = path.resolve(import.meta.dirname, "../../mobile/src/data/tugua-library.json");
const IMAGES = path.resolve(import.meta.dirname, "../../public/tugua");
const PREFS = path.join(OUTPUT, "preferences.json");
const PORT = 8787;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function readLibrary(): Library {
  return JSON.parse(fs.readFileSync(BUNDLED, "utf8")) as Library;
}

function readPrefs(): PreferenceState {
  if (!fs.existsSync(PREFS)) return EMPTY_PREFS;
  try {
    const parsed = JSON.parse(fs.readFileSync(PREFS, "utf8")) as PreferenceState;
    return Array.isArray(parsed.tags) ? { tags: parsed.tags } : EMPTY_PREFS;
  } catch {
    return EMPTY_PREFS;
  }
}

function send(res: http.ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  res.writeHead(status, { ...cors, "Content-Type": "application/json; charset=utf-8", ...extra });
  res.end(JSON.stringify(body));
}

function imageType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export function serve() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const server = http.createServer((req, res) => {
    if (!req.url || !req.method) return send(res, 400, { error: "bad request" });
    if (req.method === "OPTIONS") return send(res, 204, {});
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    if (req.method === "GET" && url.pathname === "/") {
      const data = readLibrary();
      const html = `<!doctype html><meta charset="utf-8"><title>日简数据服务</title><body style="font-family:sans-serif;padding:24px;line-height:1.6"><h1>这是本机数据服务</h1><p>看界面请打开 <a href="http://127.0.0.1:8081/">http://127.0.0.1:8081/</a>。</p><p>手机日常请填 Vercel 上的地址。这里有定稿 ${data.briefings.length} 份，给同一网络里临时预览。</p><p><a href="/api/library">查看 JSON</a></p></body>`;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") return send(res, 200, { ok: true });
    if (req.method === "GET" && url.pathname === "/api/library") {
      return send(res, 200, readLibrary(), { "Cache-Control": "public, max-age=60" });
    }
    if (req.method === "GET" && url.pathname === "/api/preferences") {
      return send(res, 200, readPrefs(), { "Cache-Control": "no-store" });
    }
    if (req.method === "GET" && url.pathname.startsWith("/tugua/")) {
      const relative = decodeURIComponent(url.pathname.slice("/tugua/".length));
      if (!relative || relative.includes("..") || path.isAbsolute(relative)) return send(res, 400, { error: "bad path" });
      const file = path.resolve(IMAGES, relative);
      const root = IMAGES.endsWith(path.sep) ? IMAGES : `${IMAGES}${path.sep}`;
      if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: "not found" });
      res.writeHead(200, { ...cors, "Content-Type": imageType(file), "Cache-Control": "public, max-age=86400" });
      fs.createReadStream(file).pipe(res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/preferences") {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        try {
          const prefs = JSON.parse(Buffer.concat(chunks).toString("utf8")) as PreferenceState;
          if (!Array.isArray(prefs.tags)) return send(res, 400, { error: "invalid json" });
          fs.writeFileSync(PREFS, JSON.stringify({ tags: prefs.tags }, null, 2), "utf8");
          send(res, 200, { ok: true, stored: true });
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
