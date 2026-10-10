import fs from "node:fs";
import path from "node:path";
import { hasRecognized, recognizedNames } from "../../mobile/src/shared/preferences.ts";
import type { Briefing, BriefingItem, Candidate, CandidatePool, Library, PreferenceState } from "../../mobile/src/shared/types.ts";
import { EMPTY_PREFS } from "../../mobile/src/shared/types.ts";
import { fetchRecentTugua, type TuguaEdition } from "./dapenti.ts";
import { localizeEditionImages } from "./images.ts";
import { isEmergency, tagDomains, topicFrom } from "./tag.ts";

const OUTPUT = path.resolve(import.meta.dirname, "../output");
const BUNDLED = path.resolve(import.meta.dirname, "../../mobile/src/data/tugua-library.json");
const BUNDLED_FLUTTER = path.resolve(import.meta.dirname, "../../flutter_app/assets/tugua-library.json");
const FLUTTER_PUBSPEC = path.resolve(import.meta.dirname, "../../flutter_app/pubspec.yaml");

export function shanghaiNow(now = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

function normalize(text: string): string {
  return text.replace(/\s+/g, "").replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "").toLowerCase();
}

function stableId(text: string): string {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function apiBase(): string {
  const fromEnv = process.env.RIJIAN_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const file = path.resolve(import.meta.dirname, "../api-base.txt");
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8").trim().replace(/\/$/, "");
}

async function readPrefs(): Promise<{ prefs: PreferenceState; note: string }> {
  const remote = apiBase();
  if (remote) {
    try {
      const response = await fetch(`${remote}/api/preferences`, { signal: AbortSignal.timeout(8000) });
      if (response.ok) {
        const json = (await response.json()) as PreferenceState & { stored?: boolean };
        if (json.stored !== false && Array.isArray(json.tags)) {
          return { prefs: { tags: json.tags }, note: `兴趣来自 ${remote}` };
        }
      }
    } catch {
      // 远程没有兴趣时，继续用本机文件。
    }
  }
  const file = path.join(OUTPUT, "preferences.json");
  if (!fs.existsSync(file)) return { prefs: EMPTY_PREFS, note: "没有已保存的兴趣" };
  try {
    return { prefs: JSON.parse(fs.readFileSync(file, "utf8")) as PreferenceState, note: "兴趣来自本机文件" };
  } catch {
    return { prefs: EMPTY_PREFS, note: "没有已保存的兴趣" };
  }
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function isPureTugua(briefing: Briefing): boolean {
  return (
    briefing.items.length > 0 &&
    briefing.items.every((item) => item.inTugua && item.heatSources.length === 1 && item.heatSources[0] === "喷嚏图卦")
  );
}

function imageUrls(briefing: Briefing): string[] {
  const urls = [briefing.imageUrl ?? ""];
  for (const item of briefing.items) {
    if (item.imageUrl) urls.push(item.imageUrl);
    for (const block of item.blocks ?? []) if (block.kind === "image") urls.push(block.url);
  }
  return urls.filter((url) => url.length > 0);
}

function isCurrentTugua(briefing: Briefing): boolean {
  if (!isPureTugua(briefing)) return false;
  if (briefing.items.some((item) => (item.blocks?.length ?? 0) === 0)) return false;
  if (briefing.items.some((item) => item.summary.startsWith("@"))) return false;
  return imageUrls(briefing).every((url) => url.startsWith("/tugua/"));
}

function purgeMixed(): void {
  const briefingDir = path.join(OUTPUT, "briefings");
  const candidateDir = path.join(OUTPUT, "candidates");
  if (fs.existsSync(briefingDir)) {
    for (const name of fs.readdirSync(briefingDir)) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(briefingDir, name);
      const briefing = readJson<Briefing>(file);
      if (!briefing || !isCurrentTugua(briefing)) fs.unlinkSync(file);
    }
  }
  if (fs.existsSync(candidateDir)) {
    for (const name of fs.readdirSync(candidateDir)) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(candidateDir, name);
      const pool = readJson<CandidatePool>(file);
      const pure = pool?.items.every((item) => item.inTugua && item.heatSources.length === 1 && item.heatSources[0] === "喷嚏图卦");
      if (!pure) fs.unlinkSync(file);
    }
  }
}

function editionTitle(phrase: string, fallback: string): string {
  const clean = phrase.replace(/\s+/g, "").trim();
  const length = [...clean].length;
  if (length >= 4 && length <= 22) return clean;
  if (length > 22) return [...clean].slice(0, 22).join("");
  const backup = [...fallback.replace(/\s+/g, "")].slice(0, 12).join("");
  return backup || "每日简报";
}

function topicBlocked(item: Candidate, topics: Set<string>): boolean {
  const text = `${item.title}${item.summary}${item.topic}`;
  for (const topic of topics) {
    if (topic.length >= 2 && (text.includes(topic) || item.topic.includes(topic))) return true;
  }
  return false;
}

function selectItems(items: Candidate[], prefs: PreferenceState): Candidate[] {
  if (!hasRecognized(prefs)) return items;
  const disliked = recognizedNames(prefs, "uninterested");
  let emergencyUsed = false;
  const selected: Candidate[] = [];
  for (const item of items) {
    if (topicBlocked(item, disliked.topics)) continue;
    const domainHit = item.domains.some((domain) => disliked.domains.has(domain));
    if (domainHit) {
      if (item.isPublicEmergency && !emergencyUsed) {
        emergencyUsed = true;
        selected.push(item);
      }
      continue;
    }
    selected.push(item);
  }
  return selected;
}

function toCandidates(edition: TuguaEdition): Candidate[] {
  return [...edition.hits]
    .sort((a, b) => a.rank - b.rank)
    .map((hit) => {
      const text = `${hit.title} ${hit.blurb ?? ""} ${hit.detail ?? ""}`;
      return {
        id: stableId(`${edition.date}:${hit.rank}:${normalize(hit.title)}`),
        title: hit.title,
        summary: hit.blurb || hit.title,
        detail: hit.detail || hit.blurb || hit.title,
        blocks: hit.blocks,
        domains: tagDomains(text),
        topic: topicFrom(hit.title),
        sourceName: hit.sourceName || "喷嚏图卦",
        sourceUrl: hit.url,
        heatSources: ["喷嚏图卦"],
        inTugua: true,
        isPublicEmergency: isEmergency(text),
        heat: 1000 - hit.rank,
        imageUrl: hit.imageUrl,
      };
    });
}

function briefingFrom(edition: TuguaEdition, prefs: PreferenceState, generatedAt: string): Briefing {
  const poolItems = selectItems(toCandidates(edition), prefs);
  const items: BriefingItem[] = poolItems.map((item, index) => ({
    ...item,
    no: index + 1,
    group: "今日要闻",
  }));
  const lede = [...items.slice(0, 3).map((item) => item.title).join("、")].slice(0, 42).join("");
  return {
    date: edition.date,
    title: editionTitle(edition.phrase, items[0]?.topic || items[0]?.title || "每日简报"),
    lede,
    imageUrl: edition.imageUrl ?? items.find((item) => item.imageUrl)?.imageUrl,
    generatedAt,
    frozen: true,
    items,
  };
}

function writeBundledLibrary(): void {
  const dir = path.join(OUTPUT, "briefings");
  const briefings = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson<Briefing>(path.join(dir, name)))
    .filter((item): item is Briefing => item !== null && isCurrentTugua(item))
    .sort((a, b) => b.date.localeCompare(a.date));
  const library: Library = { briefings, candidates: [] };
  const json = JSON.stringify(library);
  fs.mkdirSync(path.dirname(BUNDLED), { recursive: true });
  fs.mkdirSync(path.dirname(BUNDLED_FLUTTER), { recursive: true });
  fs.writeFileSync(BUNDLED, json, "utf8");
  fs.writeFileSync(BUNDLED_FLUTTER, json, "utf8");
  syncFlutterAssetDirs(briefings.map((item) => item.date));
}

function syncFlutterAssetDirs(dates: string[]): void {
  if (!fs.existsSync(FLUTTER_PUBSPEC)) return;
  const pubspec = fs.readFileSync(FLUTTER_PUBSPEC, "utf8");
  const newline = pubspec.includes("\r\n") ? "\r\n" : "\n";
  const startMark = `    # tugua-assets${newline}`;
  const endMark = `    # end-tugua-assets${newline}`;
  const start = pubspec.indexOf(startMark);
  const end = pubspec.indexOf(endMark);
  if (start < 0 || end < 0 || end < start) return;
  const lines = [...new Set(dates)].sort().map((date) => `    - assets/tugua/${date}/${newline}`).join("");
  const next = `${pubspec.slice(0, start)}${startMark}${lines}${pubspec.slice(end)}`;
  if (next !== pubspec) fs.writeFileSync(FLUTTER_PUBSPEC, next, "utf8");
}

export async function collect(now = new Date()): Promise<{ date: string; frozen: boolean; notes: string[] }> {
  const clock = shanghaiNow(now);
  const notes: string[] = [];
  const fetched = await fetchRecentTugua(5);
  notes.push(`喷嚏图卦：${fetched.note}`);
  fs.mkdirSync(path.join(OUTPUT, "candidates"), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT, "briefings"), { recursive: true });
  fs.mkdirSync(path.join(OUTPUT, "snapshots"), { recursive: true });
  purgeMixed();

  const latest = fetched.editions[0]?.date ?? clock.date;
  const savedPrefs = await readPrefs();
  notes.push(savedPrefs.note);
  let frozen = false;
  for (const edition of fetched.editions) {
    const briefingFile = path.join(OUTPUT, "briefings", `${edition.date}.json`);
    const existing = readJson<Briefing>(briefingFile);
    if (existing && isCurrentTugua(existing)) {
      notes.push(`${edition.date} 已是图卦定稿，不改写`);
      frozen = true;
      continue;
    }
    const images = await localizeEditionImages(edition);
    const briefing = briefingFrom(edition, savedPrefs.prefs, now.toISOString());
    const pool: CandidatePool = {
      date: edition.date,
      suggestedTitle: briefing.title,
      items: briefing.items,
    };
    fs.writeFileSync(path.join(OUTPUT, "candidates", `${edition.date}.json`), JSON.stringify(pool, null, 2), "utf8");
    fs.writeFileSync(briefingFile, JSON.stringify(briefing, null, 2), "utf8");
    frozen = true;
    notes.push(`${edition.date}「${briefing.title}」${briefing.items.length} 条，图片 ${images} 张，已按图卦定稿`);
  }

  if (fetched.editions.length > 0) writeBundledLibrary();
  else notes.push("没有可用图卦，内置简报未替换");

  const stamp = String(clock.minutes).padStart(4, "0");
  fs.writeFileSync(
    path.join(OUTPUT, "snapshots", `${clock.date}-${stamp}.json`),
    JSON.stringify({ date: clock.date, notes, source: "喷嚏图卦" }, null, 2),
    "utf8",
  );
  fs.writeFileSync(path.join(OUTPUT, "last-run.json"), JSON.stringify({ date: latest, frozen, notes }, null, 2), "utf8");
  return { date: latest, frozen, notes };
}
