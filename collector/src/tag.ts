import type { Domain } from "../../mobile/src/shared/types.ts";

const RULES: { domain: Domain; words: string[] }[] = [
  { domain: "人工智能", words: ["人工智能", "AI", "大模型", "芯片", "GPT"] },
  { domain: "军事与冲突", words: ["军事", "导弹", "空袭", "战争", "美军", "冲突", "武装", "袭击", "俄军", "核武器"] },
  { domain: "科学", words: ["诺贝尔", "化学奖", "物理奖", "实验室", "科学"] },
  { domain: "财经", words: ["股", "基金", "央行", "财政", "债务", "油价", "石油", "指数", "经济", "存单", "销售额"] },
  { domain: "科技", words: ["科技", "互联网", "微信", "苹果", "华为", "手机", "汽车", "小米", "懂车帝"] },
  { domain: "体育", words: ["足球", "篮球", "奥运", "冠军", "运动员", "网球", "中网", "大满贯", "乒"] },
  { domain: "健康", words: ["疫情", "病毒", "医院", "卫生", "肺炎", "鼠疫", "防疫"] },
  { domain: "气候", words: ["气候", "排放", "台风", "洪水", "高温", "地震"] },
  { domain: "文化", words: ["电影", "演员", "文学", "博物馆", "文物", "飞天", "诗人"] },
  { domain: "国际", words: ["美国", "俄罗斯", "日本", "韩国", "乌克兰", "联合国", "沙特", "加拿大", "英国", "基辅"] },
  { domain: "中国", words: ["中国", "国务院", "财政部", "北京", "国内"] },
  { domain: "社会", words: ["通报", "警方", "事故", "诈骗", "调查组"] },
];

const EMERGENCY = ["地震", "遇难", "空袭", "战争", "爆炸", "洪水", "台风", "坠机", "伤亡", "遇袭", "导弹", "疫情", "政变", "流离失所"];

export function tagDomains(text: string): Domain[] {
  const found: Domain[] = [];
  for (const rule of RULES) {
    if (rule.words.some((word) => text.includes(word))) found.push(rule.domain);
    if (found.length === 2) break;
  }
  return found.length > 0 ? found : ["社会"];
}

export function isEmergency(text: string): boolean {
  return EMERGENCY.some((word) => text.includes(word));
}

export function topicFrom(title: string): string {
  const clean = title.replace(/【\d+】/g, "").replace(/[《》「」]/g, "").trim();
  const head = clean.split(/[：:，。！？、\s]/)[0] || clean;
  return [...head].slice(0, 12).join("");
}
