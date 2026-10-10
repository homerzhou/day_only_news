import assert from "node:assert/strict";
import { assembleBriefing } from "./assemble";
import { applyReaction, setManualTag, visibleSide, visibleTags } from "./preferences";
import type { Candidate, CandidatePool, PreferenceState } from "./types";
import { EMPTY_PREFS } from "./types";

function item(partial: Pick<Candidate, "topic" | "domains" | "heat"> & Partial<Candidate>): Candidate {
  return {
    id: partial.topic,
    title: partial.title ?? partial.topic,
    summary: partial.summary ?? `${partial.topic}。`,
    sourceName: "测试",
    heatSources: ["测试"],
    inTugua: false,
    isPublicEmergency: false,
    ...partial,
  };
}

const pool: CandidatePool = {
  date: "2026-10-10",
  items: [
    item({ topic: "地震救援", domains: ["社会"], heat: 100, isPublicEmergency: true, title: "地震造成重大伤亡" }),
    item({ topic: "沙特机场", domains: ["国际", "军事与冲突"], heat: 95, isPublicEmergency: true }),
    item({ topic: "恒生科技", domains: ["财经", "科技"], heat: 90 }),
    item({ topic: "诺贝尔化学奖", domains: ["科学"], heat: 88 }),
    item({ topic: "某演员", domains: ["文化"], heat: 86 }),
    item({ topic: "人工智能芯片", domains: ["人工智能", "科技"], heat: 80 }),
    item({ topic: "世界杯", domains: ["体育"], heat: 78 }),
    item({ topic: "央行利率", domains: ["财经"], heat: 70 }),
    item({ topic: "台风登陆", domains: ["气候"], heat: 68, isPublicEmergency: true }),
    item({ topic: "医院通报", domains: ["健康"], heat: 60 }),
    item({ topic: "新电影", domains: ["文化"], heat: 55 }),
    item({ topic: "地方债", domains: ["财经", "中国"], heat: 50 }),
    item({ topic: "漫展", domains: ["文化"], heat: 40 }),
    item({ topic: "社区篮球", domains: ["体育"], heat: 30 }),
    item({ topic: "微信短剧", domains: ["科技"], heat: 48 }),
    item({ topic: "未表态甲", domains: ["国际"], heat: 45 }),
    item({ topic: "未表态乙", domains: ["社会"], heat: 44 }),
    item({ topic: "未表态丙", domains: ["健康"], heat: 43 }),
    item({ topic: "未表态丁", domains: ["气候"], heat: 20 }),
  ],
};

const plain = assembleBriefing(pool, EMPTY_PREFS, "2026-10-10T13:30:00.000Z");
assert.equal(plain.items.length, 12);
assert.ok(plain.items.every((row) => row.group === "今日要闻"));
assert.equal(plain.items[0].topic, "地震救援");

let prefs: PreferenceState = EMPTY_PREFS;
prefs = applyReaction(prefs, null, {
  reaction: "uninterested",
  domains: ["文化"],
  topic: "某演员",
});
assert.equal(visibleTags(prefs, "uninterested").some((tag) => tag.name === "某演员"), true);
assert.equal(visibleTags(prefs, "uninterested").some((tag) => tag.name === "文化"), false);

for (let i = 0; i < 2; i += 1) {
  prefs = applyReaction(prefs, null, {
    reaction: "uninterested",
    domains: ["文化"],
    topic: `文化条目${i}`,
  });
}
assert.equal(visibleTags(prefs, "uninterested").some((tag) => tag.name === "文化"), true);

prefs = applyReaction(prefs, null, {
  reaction: "interested",
  domains: ["科技"],
  topic: "恒生科技",
});
prefs = applyReaction(prefs, null, {
  reaction: "interested",
  domains: ["科技"],
  topic: "科技二",
});
prefs = applyReaction(prefs, null, {
  reaction: "interested",
  domains: ["科技"],
  topic: "科技三",
});
assert.ok(visibleTags(prefs, "interested").some((tag) => tag.kind === "domain" && tag.name === "科技"));

const shaped = assembleBriefing(pool, prefs, "2026-10-10T13:30:00.000Z");
assert.ok(!shaped.items.some((row) => row.topic === "某演员"));
assert.ok(!shaped.items.some((row) => row.topic === "新电影" || row.topic === "漫展"));
assert.equal(shaped.items.filter((row) => row.group === "今日要闻").length, 5);
const focus = shaped.items.filter((row) => row.group === "你的关注");
assert.ok(focus.length <= 10);
assert.ok(shaped.items.some((row) => row.topic === "微信短剧" && row.group === "你的关注"));
const unexpressed = focus.filter((row) => row.topic.startsWith("未表态"));
assert.ok(unexpressed.length >= 3);

const sports = setManualTag(EMPTY_PREFS, "domain", "体育", "uninterested");
const hiddenSports = assembleBriefing(pool, sports, "2026-10-10T13:30:00.000Z");
assert.ok(!hiddenSports.items.some((row) => row.topic === "世界杯"));

const emergencyPrefs = setManualTag(EMPTY_PREFS, "domain", "社会", "uninterested");
const withEmergency = assembleBriefing(pool, emergencyPrefs, "2026-10-10T13:30:00.000Z");
const emergencies = withEmergency.items.filter((row) => row.topic === "地震救援");
assert.equal(emergencies.length, 1);
assert.equal(emergencies[0].group, "今日要闻");

let undone = applyReaction(EMPTY_PREFS, null, {
  reaction: "interested",
  domains: ["科学"],
  topic: "诺贝尔化学奖",
});
undone = applyReaction(
  undone,
  { reaction: "interested", domains: ["科学"], topic: "诺贝尔化学奖" },
  null,
);
assert.equal(undone.tags.length, 0);

const manual = setManualTag(EMPTY_PREFS, "domain", "财经", "interested");
assert.equal(visibleSide(manual.tags[0]), "interested");

console.log("assemble tests ok", shaped.items.length);
