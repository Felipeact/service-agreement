// Runs supabase/tests/*.sql against SUPABASE_DB_URL. Each recipe is one query on its own connection;
// fixture.sql opens the transaction and every test file ends in rollback, so nothing persists.

export interface Recipe {
  name: string;
  /** File names in supabase/tests, or SEED_BODY for supabase/seed.sql without begin;/commit;. */
  parts: string[];
}

export interface DbClient {
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
}

export interface SuiteIO {
  argv: string[];
  env: Record<string, string | undefined>;
  testFiles: string[];
  readTestFile(name: string): string;
  readSeed(): string;
  connect(url: string): Promise<DbClient>;
  print(line: string): void;
}

const SEED_BODY = "SEED_BODY";

const plain = (name: string): Recipe => ({ name, parts: ["fixture.sql", `${name}.sql`] });

export const RECIPES: Recipe[] = [
  plain("catalog_seed"),
  plain("domain_constraints"),
  plain("events_outbox"),
  plain("rls_isolation"),
  plain("rls_roles"),
  plain("transitions"),
  plain("demo_owner"),
  plain("staff_screens"),
  plain("record_forms"),
  plain("import_upload"),
  plain("import_parse"),
  plain("import_extract"),
  plain("import_review"),
  { name: "demo_seed", parts: ["fixture.sql", SEED_BODY, "demo_seed.sql", SEED_BODY, "demo_seed_rerun.sql"] },
];

const COMMIT = /^\s*commit(\s+work)?\s*;/im;

export function seedBody(seed: string): string {
  return seed
    .split("\n")
    .filter((line) => !["begin;", "commit;"].includes(line.trim()))
    .join("\n");
}

export function assembleRecipe(recipe: Recipe, readTestFile: (name: string) => string, seed: string): string {
  const body = seedBody(seed);
  return recipe.parts
    .map((part) =>
      part === SEED_BODY
        ? body
        : readTestFile(part)
            .split("\n")
            .map((line) => (line.replace(/\r$/, "") === SEED_BODY ? body.replace(/\r?\n$/, "") : line))
            .join("\n"),
    )
    .join("\n");
}

/** The first value of the last row of the last result: pg returns an array for a multi-statement query. */
function lastValue(result: unknown): unknown {
  const results = Array.isArray(result) ? result : [result];
  const rows = (results.at(-1) as { rows?: Record<string, unknown>[] } | undefined)?.rows ?? [];
  const row = rows.at(-1);
  return row ? Object.values(row)[0] : undefined;
}

function expectedPass(recipe: Recipe): string {
  return `${recipe.parts.at(-1)!.replace(/_rerun\.sql$|\.sql$/, "")}: pass`;
}

function redactor(url: string): (text: string) => string {
  const secrets = [url];
  try {
    const password = decodeURIComponent(new URL(url).password);
    if (password) secrets.push(password);
  } catch {
    // not a URL: redact the whole value only
  }
  return (text) => secrets.reduce((out, secret) => out.split(secret).join("***"), text);
}

export async function runSuite(io: SuiteIO): Promise<number> {
  const covered = new Set(RECIPES.flatMap((recipe) => recipe.parts));
  const orphans = io.testFiles.filter((file) => !covered.has(file)).sort();
  if (orphans.length > 0) {
    for (const file of orphans) io.print(`Not in any recipe: ${file}`);
    return 2;
  }

  const unknown = io.argv.filter((name) => !RECIPES.some((recipe) => recipe.name === name));
  if (unknown.length > 0) {
    for (const name of unknown) io.print(`Unknown recipe: ${name}`);
    io.print(`Recipes: ${RECIPES.map((recipe) => recipe.name).join(", ")}`);
    return 2;
  }

  const url = io.env.SUPABASE_DB_URL?.trim();
  if (!url) {
    io.print("SUPABASE_DB_URL is not set (see web/.env.example)");
    return 2;
  }

  const selected = io.argv.length > 0 ? io.argv.map((name) => RECIPES.find((r) => r.name === name)!) : RECIPES;
  const seed = io.readSeed();
  const scripts = selected.map((recipe) => ({ recipe, sql: assembleRecipe(recipe, io.readTestFile, seed) }));
  const committing = scripts.filter(({ sql }) => COMMIT.test(sql));
  if (committing.length > 0) {
    for (const { recipe } of committing) io.print(`Refusing ${recipe.name}: it would commit`);
    return 2;
  }

  const redact = redactor(url);
  let passed = 0;
  let failed = 0;
  for (const { recipe, sql } of scripts) {
    let client: DbClient | undefined;
    try {
      client = await io.connect(url);
      const value = lastValue(await client.query(sql));
      if (value !== expectedPass(recipe)) throw new Error(`last row was ${JSON.stringify(value ?? null)}`);
      io.print(`PASS ${recipe.name}`);
      passed++;
    } catch (error) {
      io.print(redact(`FAIL ${recipe.name}: ${error instanceof Error ? error.message : String(error)}`));
      failed++;
    } finally {
      await client?.end().catch(() => {});
    }
  }
  io.print(`${passed} passed, ${failed} failed`);
  return failed > 0 ? 1 : 0;
}
