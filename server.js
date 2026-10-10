import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import libraryHandler from "./api/library.js";
import preferencesHandler from "./api/preferences.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function sendFile(response, file) {
  response.writeHead(200, {
    "Content-Type": contentType(file),
    "Access-Control-Allow-Origin": "*",
  });
  createReadStream(file).pipe(response);
}

export default async function handler(request, response) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname === "/api/library") return libraryHandler(request, response);
  if (url.pathname === "/api/preferences") return preferencesHandler(request, response);
  if (request.method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/tugua/"))) {
    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    if (!relative || relative.includes("..") || path.isAbsolute(relative)) {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "bad path" }));
      return;
    }
    const file = path.resolve(publicDir, relative);
    const base = publicDir.endsWith(path.sep) ? publicDir : `${publicDir}${path.sep}`;
    if (file.startsWith(base) && existsSync(file) && statSync(file).isFile()) {
      sendFile(response, file);
      return;
    }
  }
  response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "not found" }));
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const port = Number(process.env.PORT || 3000);
  createServer((request, response) => {
    void handler(request, response);
  }).listen(port);
}
