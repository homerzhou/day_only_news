import type { StoryBlock } from "../../mobile/src/shared/types.ts";
import { fetchText } from "./http.ts";
import type { RawHit } from "./sources.ts";

const LIST_URL = "https://www.dapenti.com/blog/blog.asp?name=xilei";

export type TuguaEdition = {
  date: string;
  phrase: string;
  pageUrl: string;
  imageUrl?: string;
  hits: RawHit[];
};

function decode(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(src: string): string {
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `https://www.dapenti.com${src}`;
  return src;
}

function firstImage(html: string): string | undefined {
  const src = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  return src ? absoluteUrl(src) : undefined;
}

function clipAt(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  const sliced = chars.slice(0, max).join("");
  const cut = Math.max(sliced.lastIndexOf("，"), sliced.lastIndexOf("、"), sliced.lastIndexOf("："), sliced.lastIndexOf(":"), sliced.lastIndexOf("；"), sliced.lastIndexOf(" "));
  return (cut >= 8 ? sliced.slice(0, cut) : sliced).replace(/[，、：:；;\s]+$/g, "");
}

function textLines(fragment: string): string[] {
  const marked = fragment
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  const decoded = marked
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/\u00a0/g, " ");
  return decoded
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/^(?:@\S+\s*)+/, "").trim())
    .filter((line) => [...line].length >= 2);
}

function parseChunk(chunk: string): { title: string; blurb: string; detail: string; blocks: StoryBlock[] } | null {
  const blocks: StoryBlock[] = [];
  for (const part of chunk.split(/(<img\b[^>]*>)/gi)) {
    if (/^<img\b/i.test(part)) {
      const src = firstImage(part);
      if (src && !/\/j911x\./i.test(src)) blocks.push({ kind: "image", url: src });
      continue;
    }
    for (const line of textLines(part)) blocks.push({ kind: "text", text: line });
  }
  const texts = blocks.flatMap((block) => (block.kind === "text" ? [block.text] : []));
  const lead = texts[0];
  if (!lead) return null;
  const title = clipAt(lead.replace(/[。！？]$/g, ""), 28);
  if ([...title].length < 8) return null;
  const follow = texts.slice(1).find((line) => !line.startsWith("@") && [...line].length >= 12);
  const summarySource = [...lead].length <= 40 && follow ? follow : lead;
  const blurb = clipAt(summarySource.replace(/[。！？]$/g, ""), 120);
  return {
    title,
    blurb: /[。！？]$/.test(blurb) ? blurb : `${blurb}。`,
    detail: texts.join("\n\n"),
    blocks,
  };
}

function editionFrom(titleHtml: string, href: string): { date: string; phrase: string; pageUrl: string } | null {
  const title = decode(titleHtml);
  const dated = title.match(/喷嚏图卦(\d{8})】(.*)/);
  if (!dated) return null;
  const ymd = dated[1];
  return {
    date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
    phrase: dated[2].replace(/\s+/g, "").trim(),
    pageUrl: `https://www.dapenti.com/blog/${href}`,
  };
}

export async function fetchRecentTugua(limit = 5): Promise<{ editions: TuguaEdition[]; note: string }> {
  try {
    const list = await fetchText(LIST_URL);
    if (list.status >= 400) return { editions: [], note: `列表 ${list.status}` };
    const pattern = /href=(?:"|')?(more\.asp\?name=xilei&id=\d+)[^>]*>([^<]*)</gi;
    const picked: { date: string; phrase: string; pageUrl: string }[] = [];
    const seen = new Set<string>();
    for (const match of list.body.matchAll(pattern)) {
      const edition = editionFrom(match[2], match[1]);
      if (!edition || seen.has(edition.date)) continue;
      seen.add(edition.date);
      picked.push(edition);
      if (picked.length >= limit) break;
    }
    if (picked.length === 0) return { editions: [], note: "列表里没有图卦" };

    const editions: TuguaEdition[] = [];
    for (const item of picked) {
      const article = await fetchText(item.pageUrl);
      if (article.status >= 400) continue;
      const html = article.body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
      const parts = html.split(/【(\d+)】/).map((part) => {
        const footer = part.search(/来源：喷嚏网|【无需App|免责声明|本站声明/);
        return footer >= 0 ? part.slice(0, footer) : part;
      });
      const hits: RawHit[] = [];
      for (let index = 1; index < parts.length; index += 2) {
        const rank = Number(parts[index]);
        const chunk = parts[index + 1] ?? "";
        const text = parseChunk(chunk);
        if (!text || !Number.isFinite(rank)) continue;
        hits.push({
          platform: "喷嚏图卦",
          rank,
          title: text.title,
          url: item.pageUrl,
          imageUrl: text.blocks.find((block) => block.kind === "image")?.url,
          inTugua: true,
          sourceName: "喷嚏图卦",
          blurb: text.blurb,
          detail: text.detail,
          blocks: text.blocks,
        });
        if (hits.length >= 30) break;
      }
      if (hits.length === 0) continue;
      editions.push({
        ...item,
        imageUrl: hits.find((hit) => hit.imageUrl)?.imageUrl,
        hits,
      });
    }
    return {
      editions,
      note: editions.length > 0 ? editions.map((item) => `${item.date} ${item.hits.length} 条`).join("；") : "图卦正文没有编号条目",
    };
  } catch (error) {
    return { editions: [], note: error instanceof Error ? error.message : "图卦失败" };
  }
}
