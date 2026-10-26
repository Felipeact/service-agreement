import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { RECIPES, assembleRecipe, runSuite, seedBody, type SuiteIO } from "./runner.mts";

const repoRoot = path.join(__dirname, "..", "..", "..");
const testsDir = path.join(repoRoot, "supabase", "tests");

const ALL = [
  "catalog_seed",
  "domain_constraints",
  "events_outbox",
  "rls_isolation",
  "rls_roles",
  "transitions",
  "demo_owner",
  "staff_screens",
  "demo_seed",
];

const REAL_FILES = readdirSync(testsDir).filter((name) => name.endsWith(".sql"));
const URL_VALUE = "postgresql://u:s3cr3t-pw@h:5432/postgres";

type Reply = { rows: Record<string, unknown>[] }[] | Error;

interface Fake {
  io: SuiteIO;
  out: string[];
  connects: number;
  sent: string[];
  ended: number;
}

/** A recipe passes by default: its last row is `<last file>: pass`. */
function passReply(recipe: string): Reply {
  const name = recipe === "demo_seed" ? "demo_seed" : recipe;
  return [{ rows: [] }, { rows: [{ result: `${name}: pass` }] }];
}

function fake(options: {
  argv?: string[];
  env?: Record<string, string | undefined>;
  files?: string[];
  read?: (name: string) => string;
  reply?: (recipe: string, index: number) => Reply;
  connectError?: (index: number) => Error | undefined;
} = {}): Fake {
  const state: Fake = { io: undefined as unknown as SuiteIO, out: [], connects: 0, sent: [], ended: 0 };
  const order = options.argv?.length ? options.argv : ALL;
  state.io = {
    argv: options.argv ?? [],
    env: options.env ?? { SUPABASE_DB_URL: URL_VALUE },
    testFiles: options.files ?? REAL_FILES,
    readTestFile: options.read ?? ((name) => `-- ${name}\nselect 1;\n`),
    readSeed: () => "-- seed\nbegin;\ninsert into seed values (1);\ncommit;\n",
    connect: async () => {
      const index = state.connects++;
      const error = options.connectError?.(index);
      if (error) throw error;
      return {
        query: async (sql: string) => {
          state.sent.push(sql);
          const recipe = order[index];
          const reply = options.reply ? options.reply(recipe, index) : passReply(recipe);
          if (reply instanceof Error) throw reply;
          return reply;
        },
        end: async () => {
          state.ended++;
        },
      };
    },
    print: (line) => state.out.push(line),
  };
  return state;
}

describe("test:db runner", () => {
  test("C201: the recipe list and each recipe's parts", () => {
    expect(RECIPES.map((recipe) => recipe.name)).toEqual(ALL);
    const parts = Object.fromEntries(RECIPES.map((recipe) => [recipe.name, recipe.parts]));
    for (const name of ["catalog_seed", "domain_constraints", "events_outbox", "rls_isolation", "rls_roles", "transitions"]) {
      expect(parts[name], name).toEqual(["fixture.sql", `${name}.sql`]);
    }
    expect(parts.demo_owner).toEqual(["fixture.sql", "demo_owner.sql"]);
    expect(parts.staff_screens).toEqual(["fixture.sql", "staff_screens.sql"]);
    expect(parts.demo_seed).toEqual(["fixture.sql", "SEED_BODY", "demo_seed.sql", "SEED_BODY", "demo_seed_rerun.sql"]);
  });

  test("C202: the seed body drops only begin; and commit;, and replaces only an exact SEED_BODY line", () => {
    const seed = "-- head\nbegin;\ninsert into a values (1);\n  -- begin; inside a comment stays\ncommit;\n";
    expect(seedBody(seed)).toBe("-- head\ninsert into a values (1);\n  -- begin; inside a comment stays\n");

    const files: Record<string, string> = {
      "fixture.sql": "F1\n",
      "staff_screens.sql": "A\nSEED_BODY\n  SEED_BODY x\nB\n",
      "demo_seed.sql": "D\n",
      "demo_seed_rerun.sql": "R\n",
    };
    const read = (name: string) => files[name];
    const body = seedBody(seed);

    expect(assembleRecipe(RECIPES.find((r) => r.name === "staff_screens")!, read, seed)).toBe(
      ["F1\n", `A\n${body}  SEED_BODY x\nB\n`].join("\n"),
    );
    expect(assembleRecipe(RECIPES.find((r) => r.name === "demo_seed")!, read, seed)).toBe(
      ["F1\n", body, "D\n", body, "R\n"].join("\n"),
    );
  });

  test("C203: no argument runs all 9, one connection each, in order, and prints PASS per recipe", async () => {
    const f = fake();
    await runSuite(f.io);
    expect(f.connects).toBe(9);
    expect(f.sent).toHaveLength(9);
    expect(f.ended).toBe(9);
    expect(f.out.slice(0, 9)).toEqual(ALL.map((name) => `PASS ${name}`));
  });

  test("C204: all passing prints 9 passed, 0 failed and exits 0", async () => {
    const f = fake();
    const code = await runSuite(f.io);
    expect(f.out.at(-1)).toBe("9 passed, 0 failed");
    expect(code).toBe(0);
  });

  test("C205: a failing recipe is reported, the rest still run, exit 1", async () => {
    const f = fake({
      reply: (recipe, index) => (index === 2 ? new Error("C3: anon can read") : passReply(recipe)),
    });
    const code = await runSuite(f.io);
    expect(f.out).toContain("FAIL events_outbox: C3: anon can read");
    expect(f.connects).toBe(9);
    expect(f.out.filter((line) => line.startsWith("PASS "))).toHaveLength(8);
    expect(f.out.at(-1)).toBe("8 passed, 1 failed");
    expect(code).toBe(1);
  });

  test.each([
    ["no rows", [{ rows: [] }]],
    ["a different text", [{ rows: [{ result: "rls_roles: fail" }] }]],
    ["pass not last", [{ rows: [{ result: "rls_roles: pass" }] }, { rows: [{ result: "other" }] }]],
    ["pass of another file", [{ rows: [{ result: "fixture: pass" }] }]],
  ])("C206: a last row with %s fails the recipe", async (_label, reply) => {
    const f = fake({ argv: ["rls_roles"], reply: () => reply });
    const code = await runSuite(f.io);
    expect(f.out[0]).toMatch(/^FAIL rls_roles: /);
    expect(f.out.at(-1)).toBe("0 passed, 1 failed");
    expect(code).toBe(1);
  });

  test("C206: demo_seed passes on demo_seed: pass, and a single result object is read too", async () => {
    const f = fake({ argv: ["demo_seed"], reply: () => [{ rows: [{ result: "demo_seed: pass" }] }] });
    expect(await runSuite(f.io)).toBe(0);
    const single = fake({ argv: ["rls_roles"] });
    single.io.connect = async () => ({
      query: async () => ({ rows: [{ result: "rls_roles: pass" }] }),
      end: async () => {},
    });
    expect(await runSuite(single.io)).toBe(0);
  });

  test("C207: named recipes run alone, in the given order", async () => {
    const f = fake({ argv: ["rls_roles", "rls_isolation"] });
    const code = await runSuite(f.io);
    expect(f.out).toEqual(["PASS rls_roles", "PASS rls_isolation", "2 passed, 0 failed"]);
    expect(f.connects).toBe(2);
    expect(code).toBe(0);
  });

  test("C208: an unknown recipe exits 2 with the names, without connecting", async () => {
    const f = fake({ argv: ["nope"] });
    const code = await runSuite(f.io);
    expect(f.out[0]).toBe("Unknown recipe: nope");
    for (const name of ALL) expect(f.out.join("\n")).toContain(name);
    expect(f.connects).toBe(0);
    expect(code).toBe(2);
  });

  test.each([
    ["unset", {}],
    ["empty", { SUPABASE_DB_URL: "" }],
    ["whitespace", { SUPABASE_DB_URL: "  " }],
  ])("C209: SUPABASE_DB_URL %s exits 2 without connecting", async (_label, env) => {
    const f = fake({ env });
    const code = await runSuite(f.io);
    expect(f.out).toEqual(["SUPABASE_DB_URL is not set (see web/.env.example)"]);
    expect(f.connects).toBe(0);
    expect(code).toBe(2);
  });

  test("C210: a test file in no recipe exits 2; every real file is in a recipe", async () => {
    const f = fake({ files: [...REAL_FILES, "orphan.sql"] });
    const code = await runSuite(f.io);
    expect(f.out).toEqual(["Not in any recipe: orphan.sql"]);
    expect(f.connects).toBe(0);
    expect(code).toBe(2);

    expect(REAL_FILES).toHaveLength(11);
    const covered = new Set(RECIPES.flatMap((recipe) => recipe.parts));
    for (const file of REAL_FILES) expect(covered.has(file), file).toBe(true);
  });

  test.each(["commit;", "COMMIT;", "  commit work;", "Commit Work ;"])(
    "C211: a recipe containing %j is refused before connecting",
    async (statement) => {
      const f = fake({
        read: (name) => (name === "rls_roles.sql" ? `select 1;\n${statement}\n` : "select 1;\n"),
      });
      const code = await runSuite(f.io);
      expect(f.out).toEqual(["Refusing rls_roles: it would commit"]);
      expect(f.connects).toBe(0);
      expect(code).toBe(2);
    },
  );

  test("C211: none of the real recipes would commit", async () => {
    const read = (name: string) => readFileSync(path.join(testsDir, name), "utf8");
    const seed = readFileSync(path.join(repoRoot, "supabase", "seed.sql"), "utf8");
    const f = fake({ read });
    f.io.readSeed = () => seed;
    expect(await runSuite(f.io)).toBe(0);
    expect(f.connects).toBe(9);
  });

  test("C212: a connection error fails that recipe and the rest still run", async () => {
    const f = fake({ connectError: (index) => (index === 0 ? new Error("connect ECONNREFUSED") : undefined) });
    const code = await runSuite(f.io);
    expect(f.out[0]).toBe("FAIL catalog_seed: connect ECONNREFUSED");
    expect(f.connects).toBe(9);
    expect(f.out.at(-1)).toBe("8 passed, 1 failed");
    expect(code).toBe(1);
  });

  test("C213: no output path prints the URL or its password", async () => {
    const runs = [
      fake(),
      fake({ reply: () => new Error(`password authentication failed for ${URL_VALUE} (s3cr3t-pw)`) }),
      fake({ connectError: () => new Error(`could not connect to ${URL_VALUE}`) }),
    ];
    for (const run of runs) {
      await runSuite(run.io);
      const all = run.out.join("\n");
      expect(all).not.toContain("s3cr3t-pw");
      expect(all).not.toContain(URL_VALUE);
    }
  });
});
