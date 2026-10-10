const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export async function fetchText(url: string, timeoutMs = 15000): Promise<{ status: number; body: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json,text/html,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get("content-type") ?? "";
  const head = bytes.subarray(0, 400).toString("latin1");
  const useGbk = /gb2312|gbk|gb18030/i.test(type) || /charset=['"]?gb/i.test(head) || url.includes("dapenti.com");
  const body = new TextDecoder(useGbk ? "gbk" : "utf-8").decode(bytes);
  return { status: response.status, body };
}
