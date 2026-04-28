import { config } from "dotenv";
import { generateListingsAndEmbeddings } from "../supabase/seed/generate-listings";

async function main() {
  config({ path: ".env.local" });
  config();
  await generateListingsAndEmbeddings();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
