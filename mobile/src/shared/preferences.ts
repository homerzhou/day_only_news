import type { Domain, ItemTags, PreferenceState, Reaction, TagKind, TagScore } from "./types";
import { DOMAINS } from "./types";

export function isDomain(name: string): name is Domain {
  return (DOMAINS as readonly string[]).includes(name);
}

function rawSide(tag: TagScore): Reaction | null {
  if (tag.interest > tag.disinterest) return "interested";
  if (tag.disinterest > tag.interest) return "uninterested";
  return null;
}

function threshold(tag: TagScore): number {
  if (tag.source === "manual") return 1;
  return tag.kind === "topic" ? 1 : 3;
}

export function visibleSide(tag: TagScore): Reaction | null {
  const side = rawSide(tag);
  if (!side) return null;
  const count = side === "interested" ? tag.interest : tag.disinterest;
  return count >= threshold(tag) ? side : null;
}

export function visibleTags(state: PreferenceState, side: Reaction): TagScore[] {
  return state.tags.filter((tag) => visibleSide(tag) === side);
}

export function hasRecognized(state: PreferenceState): boolean {
  return state.tags.some((tag) => visibleSide(tag) !== null);
}

function keyOf(kind: TagKind, name: string): string {
  return `${kind}:${name}`;
}

function clone(state: PreferenceState): TagScore[] {
  return state.tags.map((tag) => ({ ...tag }));
}

function namesFor(item: ItemTags): { kind: TagKind; name: string }[] {
  const list: { kind: TagKind; name: string }[] = [];
  for (const domain of item.domains) {
    if (isDomain(domain)) list.push({ kind: "domain", name: domain });
  }
  const topic = item.topic.trim();
  if (topic) list.push({ kind: "topic", name: topic });
  return list;
}

function bump(
  tags: TagScore[],
  kind: TagKind,
  name: string,
  previous: Reaction | null,
  next: Reaction | null,
) {
  let tag = tags.find((item) => item.kind === kind && item.name === name);
  if (!tag) {
    tag = { kind, name, interest: 0, disinterest: 0, source: "auto" };
    tags.push(tag);
  }
  const before = rawSide(tag);
  if (previous === "interested") tag.interest = Math.max(0, tag.interest - 1);
  if (previous === "uninterested") tag.disinterest = Math.max(0, tag.disinterest - 1);
  if (next === "interested") tag.interest += 1;
  if (next === "uninterested") tag.disinterest += 1;
  const after = rawSide(tag);
  if (tag.source === "manual" && before && after && before !== after) {
    tag.source = "auto";
  }
}

export function applyReaction(
  state: PreferenceState,
  previous: (ItemTags & { reaction: Reaction }) | null,
  next: (ItemTags & { reaction: Reaction }) | null,
): PreferenceState {
  const tags = clone(state);
  const touched = new Map<string, { kind: TagKind; name: string }>();
  for (const item of namesFor(previous ?? { domains: [], topic: "" })) {
    touched.set(keyOf(item.kind, item.name), item);
  }
  for (const item of namesFor(next ?? { domains: [], topic: "" })) {
    touched.set(keyOf(item.kind, item.name), item);
  }
  for (const item of touched.values()) {
    const prevHit =
      previous &&
      namesFor(previous).some((name) => name.kind === item.kind && name.name === item.name)
        ? previous.reaction
        : null;
    const nextHit =
      next && namesFor(next).some((name) => name.kind === item.kind && name.name === item.name)
        ? next.reaction
        : null;
    bump(tags, item.kind, item.name, prevHit, nextHit);
  }
  return {
    tags: tags.filter((tag) => tag.interest > 0 || tag.disinterest > 0),
  };
}

export function removeTag(state: PreferenceState, kind: TagKind, name: string): PreferenceState {
  return { tags: state.tags.filter((tag) => !(tag.kind === kind && tag.name === name)) };
}

export function setManualTag(
  state: PreferenceState,
  kind: TagKind,
  name: string,
  side: Reaction,
): PreferenceState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  if (kind === "domain" && !isDomain(trimmed)) return state;
  if (kind === "topic" && ([...trimmed].length < 2 || [...trimmed].length > 12)) return state;
  const tags = state.tags.filter((tag) => !(tag.kind === kind && tag.name === trimmed));
  tags.push({
    kind,
    name: trimmed,
    interest: side === "interested" ? 1 : 0,
    disinterest: side === "uninterested" ? 1 : 0,
    source: "manual",
  });
  return { tags };
}

export function recognizedNames(state: PreferenceState, side: Reaction): { domains: Set<string>; topics: Set<string> } {
  const domains = new Set<string>();
  const topics = new Set<string>();
  for (const tag of visibleTags(state, side)) {
    if (tag.kind === "domain") domains.add(tag.name);
    else topics.add(tag.name);
  }
  return { domains, topics };
}
