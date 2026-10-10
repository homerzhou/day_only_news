import type { StoryBlock } from "../../mobile/src/shared/types.ts";
import { fetchText } from "./http.ts";

export type RawHit = {
  platform: string;
  rank: number;
  title: string;
  url?: string;
  imageUrl?: string;
  inTugua: boolean;
  sourceName?: string;
  blurb?: string;
  detail?: string;
  blocks?: StoryBlock[];
};

type SourceResult = { platform: string; hits: RawHit[]; note: string };

function ok(platform: string, hits: RawHit[]): SourceResult {
  return { platform, hits, note: hits.length > 0 ? `取得 ${hits.length} 条` : "榜单为空" };
}

function fail(platform: string, note: string): SourceResult {
  return { platform, hits: [], note };
}

async function readJson(url: string): Promise<unknown> {
  const { status, body } = await fetchText(url);
  if (status >= 400) throw new Error(String(status));
  if (body.trim().startsWith("<")) throw new Error("html");
  return JSON.parse(body);
}

export async function fetchBaidu(): Promise<SourceResult> {
  const platform = "百度热搜";
  try {
    const data = (await readJson("https://top.baidu.com/api/board?platform=wise&tab=realtime")) as {
      data?: { cards?: { content?: { content?: { word?: string; url?: string; index?: number; isTop?: boolean }[] }[] }[] };
    };
    const hits: RawHit[] = [];
    for (const card of data.data?.cards ?? []) {
      for (const block of card.content ?? []) {
        for (const row of block.content ?? []) {
          if (!row.word) continue;
          hits.push({
            platform,
            rank: row.index ?? hits.length + 1,
            title: row.word,
            url: row.url,
            inTugua: false,
          });
        }
      }
    }
    return ok(platform, hits.slice(0, 30));
  } catch (error) {
    return fail(platform, error instanceof Error ? error.message : "失败");
  }
}

export async function fetchToutiao(): Promise<SourceResult> {
  const platform = "今日头条热榜";
  try {
    const data = (await readJson("https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc")) as {
      data?: { Title?: string; Url?: string; Image?: { url?: string } }[];
    };
    const hits = (data.data ?? []).slice(0, 30).map((row, index) => ({
      platform,
      rank: index + 1,
      title: row.Title ?? "",
      url: row.Url,
      imageUrl: row.Image?.url,
      inTugua: false,
    })).filter((row) => row.title);
    return ok(platform, hits);
  } catch (error) {
    return fail(platform, error instanceof Error ? error.message : "失败");
  }
}

export async function fetchDouyin(): Promise<SourceResult> {
  const platform = "抖音热点";
  try {
    const data = (await readJson(
      "https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383",
    )) as {
      data?: {
        word_list?: { word?: string; word_cover?: { url_list?: string[] } }[];
        trending_list?: { word?: string; word_cover?: { url_list?: string[] } }[];
      };
    };
    const rows = data.data?.word_list?.length ? data.data.word_list : data.data?.trending_list ?? [];
    const hits = rows.slice(0, 30).map((row, index) => ({
      platform,
      rank: index + 1,
      title: row.word ?? "",
      imageUrl: row.word_cover?.url_list?.[0],
      inTugua: false,
    })).filter((row) => row.title);
    return ok(platform, hits);
  } catch (error) {
    return fail(platform, error instanceof Error ? error.message : "失败");
  }
}

export async function fetchBilibili(): Promise<SourceResult> {
  const platform = "B站热搜";
  try {
    const data = (await readJson("https://api.bilibili.com/x/web-interface/search/square?limit=30")) as {
      data?: { trending?: { list?: { keyword?: string; show_name?: string }[] } };
    };
    const hits = (data.data?.trending?.list ?? []).slice(0, 30).map((row, index) => ({
      platform,
      rank: index + 1,
      title: row.show_name || row.keyword || "",
      url: "https://search.bilibili.com/all?keyword=" + encodeURIComponent(row.keyword || row.show_name || ""),
      inTugua: false,
    })).filter((row) => row.title);
    return ok(platform, hits);
  } catch (error) {
    return fail(platform, error instanceof Error ? error.message : "失败");
  }
}

export async function fetchWeibo(): Promise<SourceResult> {
  const platform = "微博热搜";
  try {
    const { status, body } = await fetchText("https://weibo.com/ajax/side/hotSearch");
    if (status >= 400 || body.includes("Sina Visitor System") || body.trim().startsWith("<")) {
      return fail(platform, "热搜页要求访客验证，已跳过");
    }
    const data = JSON.parse(body) as { data?: { realtime?: { word?: string; note?: string; num?: number }[] } };
    const hits = (data.data?.realtime ?? []).slice(0, 30).map((row, index) => ({
      platform,
      rank: index + 1,
      title: row.word || row.note || "",
      url: row.word ? `https://s.weibo.com/weibo?q=${encodeURIComponent(row.word)}` : undefined,
      inTugua: false,
    })).filter((row) => row.title);
    return ok(platform, hits);
  } catch (error) {
    return fail(platform, error instanceof Error ? error.message : "失败");
  }
}

export async function fetchZhihu(): Promise<SourceResult> {
  const platform = "知乎热榜";
  try {
    const { status, body } = await fetchText("https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=30");
    if (status >= 400 || body.trim().startsWith("<")) return fail(platform, "热榜未开放，已跳过");
    const data = JSON.parse(body) as { data?: { target?: { title?: string }; detail_text?: string }[] };
    const hits = (data.data ?? []).slice(0, 30).map((row, index) => ({
      platform,
      rank: index + 1,
      title: row.target?.title ?? "",
      url: "https://www.zhihu.com/hot",
      inTugua: false,
    })).filter((row) => row.title);
    return ok(platform, hits);
  } catch (error) {
    return fail(platform, error instanceof Error ? error.message : "失败");
  }
}

export async function fetchGoogleTrends(): Promise<SourceResult> {
  const platform = "Google Trends";
  try {
    const { status, body } = await fetchText("https://trends.google.com/trending/rss?geo=CN");
    if (status >= 400) return fail(platform, String(status));
    const titles = [...body.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)]
      .map((match) => match[1].trim())
      .filter((title) => title && title !== "Daily Search Trends");
    const hits = titles.slice(0, 20).map((title, index) => ({
      platform,
      rank: index + 1,
      title,
      url: "https://trends.google.com/trending?geo=CN",
      inTugua: false,
    }));
    return ok(platform, hits);
  } catch (error) {
    return fail(platform, error instanceof Error ? error.message : "失败");
  }
}

export async function fetchHotLists(): Promise<SourceResult[]> {
  return Promise.all([
    fetchBaidu(),
    fetchToutiao(),
    fetchDouyin(),
    fetchBilibili(),
    fetchWeibo(),
    fetchZhihu(),
    fetchGoogleTrends(),
  ]);
}
