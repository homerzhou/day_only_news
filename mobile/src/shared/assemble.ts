import { hasRecognized, recognizedNames } from "./preferences";
import type { Briefing, BriefingItem, Candidate, CandidatePool, PreferenceState } from "./types";

function byHeat(a: Candidate, b: Candidate): number {
  return b.heat - a.heat || a.id.localeCompare(b.id);
}

function chars(value: string): string[] {
  return [...value];
}

export function clampPhrase(value: string): string {
  const clean = value.replace(/\s+/g, "").trim();
  const list = chars(clean);
  if (list.length <= 12) return clean;
  return list.slice(0, 12).join("");
}

function topicHit(text: string, topic: string, topics: Set<string>): boolean {
  if (topics.has(topic)) return true;
  for (const name of topics) {
    if (name.length >= 2 && (text.includes(name) || topic.includes(name))) return true;
  }
  return false;
}

function domainHit(domains: string[], blocked: Set<string>): boolean {
  return domains.some((domain) => blocked.has(domain));
}

function isUnexpressed(
  item: Candidate,
  knownDomains: Set<string>,
  knownTopics: Set<string>,
): boolean {
  if (topicHit(item.title, item.topic, knownTopics)) return false;
  if (domainHit(item.domains, knownDomains)) return false;
  return true;
}

function interestRank(item: Candidate, topics: Set<string>, domains: Set<string>): number {
  if (topicHit(item.title, item.topic, topics)) return 0;
  if (domainHit(item.domains, domains)) return 1;
  return 2;
}

export function assembleBriefing(
  pool: CandidatePool,
  prefs: PreferenceState,
  generatedAt: string,
): Briefing {
  const liked = recognizedNames(prefs, "interested");
  const disliked = recognizedNames(prefs, "uninterested");
  const knownDomains = new Set([...liked.domains, ...disliked.domains]);
  const knownTopics = new Set([...liked.topics, ...disliked.topics]);

  const topicBlocked = (item: Candidate) => topicHit(item.title, item.topic, disliked.topics);
  const domainBlocked = (item: Candidate) => domainHit(item.domains, disliked.domains);

  const normal = pool.items.filter((item) => !topicBlocked(item) && !domainBlocked(item)).sort(byHeat);
  const exceptions = pool.items
    .filter((item) => !topicBlocked(item) && domainBlocked(item) && item.isPublicEmergency)
    .sort(byHeat);

  let selectedHead: Candidate[];
  let selectedFocus: Candidate[] = [];

  if (!hasRecognized(prefs)) {
    selectedHead = normal.slice(0, 12);
  } else {
    selectedHead = normal.slice(0, 5);
    const overall = [...normal, ...exceptions].sort(byHeat).slice(0, 5);
    const exception = overall.find((item) => exceptions.some((row) => row.id === item.id));
    if (exception && !selectedHead.some((item) => item.id === exception.id)) {
      selectedHead = [...selectedHead.slice(0, 4), exception].sort(byHeat);
    }

    const headIds = new Set(selectedHead.map((item) => item.id));
    const rest = normal.filter((item) => !headIds.has(item.id));
    const unexpressed = rest.filter((item) => isUnexpressed(item, knownDomains, knownTopics));
    const reserved = unexpressed.slice(0, 3);
    const reservedIds = new Set(reserved.map((item) => item.id));
    const interested = rest
      .filter((item) => !reservedIds.has(item.id) && interestRank(item, liked.topics, liked.domains) < 2)
      .sort(
        (a, b) =>
          interestRank(a, liked.topics, liked.domains) - interestRank(b, liked.topics, liked.domains) ||
          byHeat(a, b),
      );
    const focus = [...interested.slice(0, 7), ...reserved];
    if (focus.length < 10) {
      for (const item of unexpressed) {
        if (focus.length >= 10) break;
        if (!focus.some((row) => row.id === item.id)) focus.push(item);
      }
    }
    selectedFocus = focus
      .slice(0, 10)
      .sort(
        (a, b) =>
          interestRank(a, liked.topics, liked.domains) - interestRank(b, liked.topics, liked.domains) ||
          byHeat(a, b),
      );
  }

  const ordered = [
    ...selectedHead.map((item) => ({ item, group: "今日要闻" as const })),
    ...selectedFocus.map((item) => ({ item, group: "你的关注" as const })),
  ];
  const items: BriefingItem[] = ordered.map((row, index) => ({
    ...row.item,
    no: index + 1,
    group: row.group,
  }));

  const lead = [...selectedHead, ...selectedFocus].sort(byHeat)[0];
  const suggested = pool.suggestedTitle?.trim() ?? "";
  const suggestedOk = chars(suggested).length >= 4 && chars(suggested).length <= 12;
  const title = suggestedOk ? suggested : clampPhrase(lead?.topic || lead?.title || "每日简报");
  const lede = items
    .slice(0, 3)
    .map((item) => item.title)
    .join("、");

  return {
    date: pool.date,
    title,
    lede: chars(lede).slice(0, 42).join(""),
    imageUrl: lead?.imageUrl,
    generatedAt,
    frozen: false,
    items,
  };
}
