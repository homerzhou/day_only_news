export const DOMAINS = [
  "国际",
  "中国",
  "财经",
  "科技",
  "人工智能",
  "科学",
  "军事与冲突",
  "社会",
  "气候",
  "文化",
  "体育",
  "健康",
] as const;

export type Domain = (typeof DOMAINS)[number];

export type TagKind = "domain" | "topic";

export type Reaction = "interested" | "uninterested";

export type TagScore = {
  kind: TagKind;
  name: string;
  interest: number;
  disinterest: number;
  source: "auto" | "manual";
};

export type PreferenceState = {
  tags: TagScore[];
};

export type ItemTags = {
  domains: Domain[];
  topic: string;
};

export type StoredReaction = ItemTags & {
  reaction: Reaction;
};

export type StoryBlock = { kind: "text"; text: string } | { kind: "image"; url: string };

export type Candidate = ItemTags & {
  id: string;
  title: string;
  summary: string;
  detail?: string;
  blocks?: StoryBlock[];
  sourceName: string;
  sourceUrl?: string;
  heatSources: string[];
  inTugua: boolean;
  isPublicEmergency: boolean;
  heat: number;
  imageUrl?: string;
};

export type CandidatePool = {
  date: string;
  suggestedTitle?: string;
  items: Candidate[];
};

export type BriefingGroup = "今日要闻" | "你的关注";

export type BriefingItem = Candidate & {
  no: number;
  group: BriefingGroup;
};

export type Briefing = {
  date: string;
  title: string;
  lede: string;
  imageUrl?: string;
  generatedAt: string;
  frozen: boolean;
  items: BriefingItem[];
};

export type Library = {
  briefings: Briefing[];
  candidates: CandidatePool[];
};

export const EMPTY_PREFS: PreferenceState = { tags: [] };
