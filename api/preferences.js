const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

const BLOB_PATH = "rijian/preferences.json";

function send(response, status, body) {
  response.writeHead(status, headers);
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string" && request.body) return JSON.parse(request.body);
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return null;
  return JSON.parse(text);
}

async function blobApi() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  return import("@vercel/blob");
}

async function loadPreferences() {
  const blob = await blobApi();
  if (!blob) return { tags: [], stored: false };
  const result = await blob.get(BLOB_PATH, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return { tags: [] };
  const json = JSON.parse(await new Response(result.stream).text());
  return { tags: Array.isArray(json.tags) ? json.tags : [] };
}

async function savePreferences(prefs) {
  const blob = await blobApi();
  if (!blob) return false;
  await blob.put(BLOB_PATH, JSON.stringify(prefs), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
  return true;
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, headers);
    response.end();
    return;
  }
  if (request.method === "GET") {
    try {
      send(response, 200, await loadPreferences());
    } catch {
      send(response, 200, { tags: [], stored: false });
    }
    return;
  }
  if (request.method !== "POST") {
    send(response, 405, { error: "method" });
    return;
  }
  try {
    const body = await readBody(request);
    if (!body || !Array.isArray(body.tags)) {
      send(response, 400, { error: "invalid json" });
      return;
    }
    const stored = await savePreferences({ tags: body.tags });
    send(response, 200, { ok: true, stored });
  } catch {
    send(response, 400, { error: "invalid json" });
  }
}
