export function formatBriefingDate(isoDate: string, now = new Date()): string {
  const instant = new Date(`${isoDate}T12:00:00+08:00`);
  const weekday = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(instant);
  const yearNow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(now);
  const [year, month, day] = isoDate.split("-");
  const prefix = year === yearNow ? "" : `${year}年`;
  return `${prefix}${Number(month)}月${Number(day)}日 ${weekday}`;
}

export function shanghaiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
