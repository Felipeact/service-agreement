// `npm run test:db [recipe...]` - see runner.mts.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runSuite } from "./runner.mts";

const supabaseDir = fileURLToPath(new URL("../../../supabase/", import.meta.url));
const testsDir = `${supabaseDir}tests/`;

process.exitCode = await runSuite({
  argv: process.argv.slice(2),
  env: process.env,
  testFiles: readdirSync(testsDir).filter((name) => name.endsWith(".sql")),
  readTestFile: (name) => readFileSync(`${testsDir}${name}`, "utf8"),
  readSeed: () => readFileSync(`${supabaseDir}seed.sql`, "utf8"),
  connect: async (url) => {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    return client;
  },
  print: (line) => console.log(line),
});
