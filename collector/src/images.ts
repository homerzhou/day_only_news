import fs from "node:fs";
import path from "node:path";
import type { TuguaEdition } from "./dapenti.ts";

const PUBLIC = path.resolve(import.meta.dirname, "../../mobile/public/tugua");
const FLUTTER_PUBLIC = path.resolve(import.meta.dirname, "../../flutter_app/assets/tugua");
const SITE_PUBLIC = path.resolve(import.meta.dirname, "../../public/tugua");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function extension(type: string, bytes: Buffer): string | null {
  const head = bytes.subarray(0, 12);
  if (head[0] === 0xff && head[1] === 0xd8) return "jpg";
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "png";
  if (head.subarray(0, 3).toString("ascii") === "GIF") return "gif";
  if (head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (type.includes("jpeg")) return "jpg";
  if (type.includes("png")) return "png";
  if (type.includes("gif")) return "gif";
  if (type.includes("webp")) return "webp";
  return null;
}

async function saveImage(remote: string, dir: string, name: string, referer: string): Promise<string | null> {
  try {
    const response = await fetch(remote, {
      headers: { "User-Agent": UA, Referer: referer, Accept: "image/avif,image/webp,image/*,*/*" },
      signal: AbortSignal.timeout(20000),
    });
    if (response.status >= 400) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    const ext = extension(response.headers.get("content-type") ?? "", bytes);
    if (!ext || bytes.length < 500) return null;
    fs.writeFileSync(path.join(dir, `${name}.${ext}`), bytes);
    return `${name}.${ext}`;
  } catch {
    return null;
  }
}

async function runPool(jobs: Array<() => Promise<void>>, limit: number): Promise<void> {
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      await jobs[index]();
    }
  }
  const size = Math.min(limit, jobs.length);
  await Promise.all(Array.from({ length: size }, () => worker()));
}

export async function localizeEditionImages(edition: TuguaEdition): Promise<number> {
  const dir = path.join(PUBLIC, edition.date);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const jobs: Array<() => Promise<void>> = [];
  let saved = 0;
  for (const hit of edition.hits) {
    let imageIndex = 0;
    for (const block of hit.blocks ?? []) {
      if (block.kind !== "image") continue;
      const remote = block.url;
      const name = `${String(hit.rank).padStart(2, "0")}-${imageIndex}`;
      imageIndex += 1;
      jobs.push(async () => {
        const file = await saveImage(remote, dir, name, edition.pageUrl);
        block.url = file ? `/tugua/${edition.date}/${file}` : "";
        if (file) saved += 1;
      });
    }
  }
  await runPool(jobs, 6);
  for (const hit of edition.hits) {
    const blocks = (hit.blocks ?? []).filter((block) => block.kind === "text" || block.url.startsWith("/tugua/"));
    hit.blocks = blocks;
    const image = blocks.find((block) => block.kind === "image");
    hit.imageUrl = image?.kind === "image" ? image.url : undefined;
  }
  edition.imageUrl = edition.hits.find((hit) => hit.imageUrl)?.imageUrl;
  fs.mkdirSync(FLUTTER_PUBLIC, { recursive: true });
  const flutterDir = path.join(FLUTTER_PUBLIC, edition.date);
  fs.rmSync(flutterDir, { recursive: true, force: true });
  fs.cpSync(dir, flutterDir, { recursive: true });
  fs.mkdirSync(SITE_PUBLIC, { recursive: true });
  const siteDir = path.join(SITE_PUBLIC, edition.date);
  fs.rmSync(siteDir, { recursive: true, force: true });
  fs.cpSync(dir, siteDir, { recursive: true });
  return saved;
}
