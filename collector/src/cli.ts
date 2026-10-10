import { collect } from "./pipeline.ts";
import { serve } from "./server.ts";

const command = process.argv[2] ?? "collect";

if (command === "serve") {
  serve();
} else if (command === "collect") {
  const result = await collect();
  for (const note of result.notes) console.log(note);
  console.log(result.frozen ? `${result.date} 已定稿` : `${result.date} 未定稿`);
} else {
  console.error("用法: tsx src/cli.ts collect|serve");
  process.exit(1);
}
