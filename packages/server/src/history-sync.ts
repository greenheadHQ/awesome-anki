import { runHistorySyncNow } from "./history/sync.js";

async function main() {
  const result = await runHistorySyncNow();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("history:sync failed:", message);
  process.exit(1);
});
