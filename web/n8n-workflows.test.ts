import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/** The n8n exports of outbox-dispatch door 8, read as data. */
const DIR = path.join(__dirname, "..", "automation", "n8n");
const FILES = ["events.json", "W1-agreement-sent.json", "W3-agreement-decided.json", "W5-stale-daily.json"];

type N8nNode = { name: string; type: string; parameters: Record<string, unknown>; credentials?: Record<string, unknown>; onError?: string };
type Link = { node: string; type: string; index: number };
type Workflow = { nodes: N8nNode[]; connections: Record<string, { main: Link[][] }> };

const raw = (file: string) => readFileSync(path.join(DIR, file), "utf8");
const load = (file: string) => JSON.parse(raw(file)) as Workflow;
const byName = (wf: Workflow, name: string) => wf.nodes.find((node) => node.name === name) as N8nNode;
const nextOf = (wf: Workflow, name: string, output = 0) => (wf.connections[name]?.main[output] ?? []).map((link) => byName(wf, link.node));
const previousOf = (wf: Workflow, name: string) =>
  Object.entries(wf.connections)
    .filter(([, { main }]) => main.some((links) => links.some((link) => link.node === name)))
    .map(([from]) => byName(wf, from));

/** Every node reachable from `name`'s output `output`, the start excluded. */
function reachable(wf: Workflow, name: string, output: number): N8nNode[] {
  const seen = new Map<string, N8nNode>();
  const stack = nextOf(wf, name, output);
  while (stack.length) {
    const node = stack.pop() as N8nNode;
    if (seen.has(node.name)) continue;
    seen.set(node.name, node);
    for (const links of wf.connections[node.name]?.main ?? []) stack.push(...links.map((link) => byName(wf, link.node)));
  }
  return [...seen.values()];
}

const notifyNodes = (wf: Workflow) =>
  wf.nodes.filter((node) => node.type === "n8n-nodes-base.httpRequest" && String(node.parameters.url).includes("/api/automation/notify"));

/** The Set node whose `body` the notify node sends: notify <- Crypto <- Set. */
function bodyOf(wf: Workflow, notify: N8nNode): { body: string; signer: N8nNode } {
  const [signer] = previousOf(wf, notify.name);
  const [set] = previousOf(wf, signer.name);
  const assignments = (set.parameters.assignments as { assignments: { name: string; value: string }[] }).assignments;
  return { body: assignments.find((assignment) => assignment.name === "body")?.value ?? "", signer };
}

/** n8n's IF filter for the operators the exports use: an expression `={{ … }}` is evaluated with $json and $runIndex. */
function evaluate(value: unknown, scope: { $json: Record<string, unknown>; $runIndex: number }): unknown {
  if (typeof value !== "string" || !value.startsWith("=")) return value;
  const whole = value.match(/^=\{\{([\s\S]*)\}\}$/);
  if (!whole) throw new Error(`unsupported expression ${value}`);
  return new Function("$json", "$runIndex", `return (${whole[1]});`)(scope.$json, scope.$runIndex);
}

type Condition = { leftValue: unknown; rightValue: unknown; operator: { type: string; operation: string } };
function ifPasses(node: N8nNode, scope: { $json: Record<string, unknown>; $runIndex: number }): boolean {
  const { combinator, conditions } = node.parameters.conditions as { combinator: string; conditions: Condition[] };
  const results = conditions.map(({ leftValue, rightValue, operator }) => {
    const left = evaluate(leftValue, scope);
    const right = evaluate(rightValue, scope);
    switch (operator.operation) {
      case "true": return left === true;
      case "false": return left === false;
      case "equals": return left === right;
      case "notEquals": return left !== right;
      case "lt": return Number(left) < Number(right);
      case "lte": return Number(left) <= Number(right);
      case "gt": return Number(left) > Number(right);
      case "gte": return Number(left) >= Number(right);
      default: throw new Error(`unsupported operator ${operator.operation}`);
    }
  });
  return combinator === "or" ? results.some(Boolean) : results.every(Boolean);
}

type Answer = number | "network";
type Run = { calls: number; tenMinuteWaits: number; failed: boolean; exit: N8nNode | null; keys: string[]; signedBeforeEachCall: boolean };

/**
 * Runs one notify call as n8n would, from its Set node, answering each request with the next entry of `answers`
 * (the last one repeats). A non-2xx status fails the node unless Never Error is on; a network error fails it unless
 * On Error is "Continue (using error output)", which sends the item to output 1. Without "Include Response Headers
 * and Status" the item carries no statusCode. The run stops at the first node outside the call's own loop.
 */
function runCall(wf: Workflow, notify: N8nNode, answers: Answer[]): Run {
  const signer = previousOf(wf, notify.name)[0];
  const set = previousOf(wf, signer.name)[0];
  const runs = new Map<string, number>();
  const run: Run = { calls: 0, tenMinuteWaits: 0, failed: false, exit: null, keys: [], signedBeforeEachCall: true };
  let lastWasSigner = false;
  let json: Record<string, unknown> = {};
  let current: N8nNode | undefined = set;
  for (let steps = 0; current && steps < 1000; steps++) {
    const node: N8nNode = current;
    const runIndex = runs.get(node.name) ?? 0;
    runs.set(node.name, runIndex + 1);
    let output = 0;
    if (node.name === set.name) {
      const body = (node.parameters.assignments as { assignments: { name: string; value: string }[] }).assignments.find((a) => a.name === "body")?.value ?? "";
      run.keys.push(body.match(/idempotencyKey: ([^,]*),/)?.[1] ?? "");
    } else if (node.name === notify.name) {
      run.signedBeforeEachCall &&= lastWasSigner;
      const answer = answers[Math.min(run.calls, answers.length - 1)];
      run.calls += 1;
      const response = (node.parameters.options as { response?: { response?: { fullResponse?: boolean; neverError?: boolean } } }).response?.response ?? {};
      const failure = answer === "network" || ((answer < 200 || answer > 299) && !response.neverError);
      if (failure) {
        if (node.onError !== "continueErrorOutput") {
          run.failed = true;
          return run;
        }
        output = 1;
        json = { error: { message: answer === "network" ? "ECONNREFUSED" : `status ${answer}` } };
      } else {
        json = response.fullResponse ? { body: {}, headers: {}, statusCode: answer, statusMessage: "" } : {};
      }
    } else if (node.type === "n8n-nodes-base.if") {
      output = ifPasses(node, { $json: json, $runIndex: runIndex }) ? 0 : 1;
    } else if (node.type === "n8n-nodes-base.wait" && node.parameters.amount === 10 && node.parameters.unit === "minutes") {
      run.tenMinuteWaits += 1;
    } else if (node.name !== signer.name) {
      run.exit = node;
      return run;
    }
    lastWasSigner = node.name === signer.name;
    const next = nextOf(wf, node.name, output);
    expect(next.length, `${node.name} output ${output}`).toBeLessThanOrEqual(1);
    current = next[0];
  }
  return run;
}

describe("the n8n workflow exports", () => {
  test("C1002: the fixed vector gives the same hex in Node createHmac, the function n8n's Crypto node uses, as in SQL", () => {
    const hex = createHmac("sha256", "test-secret").update("1700000000" + "." + '{"a":1}').digest("hex");
    expect(hex).toBe("8cb2c3355fca388e9ac2caec004f4d5d7045d74937ab5faad61dc11682247a9f");
  });

  test("C1033: the folder holds exactly the four exports, each valid JSON with nodes and connections", () => {
    expect(readdirSync(DIR).sort()).toEqual([...FILES].sort());
    for (const file of FILES) {
      const wf = load(file);
      expect(Array.isArray(wf.nodes), file).toBe(true);
      expect(wf.nodes.length, file).toBeGreaterThan(0);
      expect(typeof wf.connections, file).toBe("object");
    }
  });

  test("C1033: no export holds a credential value, the test secret or a 64-hex string", () => {
    for (const file of FILES) {
      const text = raw(file);
      expect(text, file).not.toContain("test-secret");
      expect(text, file).not.toMatch(/[0-9a-fA-F]{64}/);
      for (const node of load(file).nodes) {
        for (const credential of Object.values(node.credentials ?? {})) {
          expect(Object.keys(credential as object).every((key) => key === "id" || key === "name"), `${file} ${node.name}`).toBe(true);
        }
      }
    }
  });

  test("C1033: W1 has exactly 2 day-scale Waits, 3 days then 4 days, in that order", () => {
    const wf = load("W1-agreement-sent.json");
    const waits = wf.nodes.filter((node) => node.type === "n8n-nodes-base.wait" && node.parameters.unit === "days");
    expect(waits).toHaveLength(2);
    const [first, second] = waits;
    expect(first.parameters).toMatchObject({ resume: "timeInterval", amount: 3, unit: "days" });
    expect(second.parameters).toMatchObject({ resume: "timeInterval", amount: 4, unit: "days" });
    expect(reachable(wf, first.name, 0).map((node) => node.name)).toContain(second.name);
    expect(reachable(wf, second.name, 0).map((node) => node.name)).not.toContain(first.name);
  });

  test.each([
    ["W1-agreement-sent.json", [
      ["customer_link", /idempotencyKey: 'w1:' \+ [^,]*eventId \+ ':link'/],
      ["customer_reminder", /idempotencyKey: 'w1:' \+ [^,]*eventId \+ ':day3'/],
      ["customer_reminder", /idempotencyKey: 'w1:' \+ [^,]*eventId \+ ':day7'/],
    ]],
    ["W3-agreement-decided.json", [["staff_decision", /idempotencyKey: 'w3:' \+ [^,]*eventId[ ,]/]]],
    ["W5-stale-daily.json", [["staff_stale", /idempotencyKey: 'w5:' \+ \$now[^,]*toFormat\('yyyy-MM-dd'\)/]]],
  ] as const)("C1033: every notify call in %s sends kind, a door-4 key and executionId from $execution.id, signed", (file, expected) => {
    const wf = load(file);
    const calls = notifyNodes(wf);
    expect(calls).toHaveLength(expected.length);
    calls.forEach((call, i) => {
      const [kind, key] = expected[i];
      const { body, signer } = bodyOf(wf, call);
      expect(body).toContain(`kind: '${kind}'`);
      expect(body).toMatch(key);
      expect(body).toContain("executionId: $execution.id");
      expect(body).toMatch(/^=\{\{ JSON\.stringify\(/);
      // The body sent is the body signed, with door 2's headers.
      expect(call.parameters).toMatchObject({ method: "POST", sendBody: true, contentType: "raw", body: "={{ $json.body }}" });
      const headers = (call.parameters.headerParameters as { parameters: { name: string; value: string }[] }).parameters;
      expect(headers).toEqual([
        { name: "X-SA-Timestamp", value: "={{ $json.timestamp }}" },
        { name: "X-SA-Signature", value: "=sha256={{ $json.signature }}" },
      ]);
      expect(signer.type).toBe("n8n-nodes-base.crypto");
      expect(signer.parameters).toMatchObject({ action: "hmac", type: "SHA256", encoding: "hex", dataPropertyName: "signature", value: "={{ $json.timestamp }}.{{ $json.body }}" });
    });
  });

  test("C1033: W5's Schedule trigger runs daily at 08:00 in America/Vancouver", () => {
    const wf = load("W5-stale-daily.json") as Workflow & { settings: { timezone: string } };
    const schedule = wf.nodes.find((node) => node.type === "n8n-nodes-base.scheduleTrigger") as N8nNode;
    const interval = (schedule.parameters.rule as { interval: Record<string, unknown>[] }).interval;
    expect(interval).toEqual([{ field: "days", daysInterval: 1, triggerAtHour: 8, triggerAtMinute: 0 }]);
    expect(wf.settings.timezone).toBe("America/Vancouver");
  });

  test("C1034: the events webhook answers on receipt and routes exactly three types; the fallback starts no workflow", () => {
    const wf = load("events.json");
    const webhook = wf.nodes.find((node) => node.type === "n8n-nodes-base.webhook") as N8nNode;
    expect(webhook.parameters.responseMode).toBe("onReceived");
    expect(webhook.parameters.httpMethod).toBe("POST");

    const router = wf.nodes.find((node) => node.type === "n8n-nodes-base.switch") as N8nNode;
    const rules = (router.parameters.rules as { values: { conditions: { conditions: { leftValue: string; rightValue: string }[] } }[] }).values;
    const routed = rules.map((rule) => {
      expect(rule.conditions.conditions).toHaveLength(1);
      expect(rule.conditions.conditions[0].leftValue).toBe("={{ $json.type }}");
      return rule.conditions.conditions[0].rightValue;
    });
    expect(routed).toEqual(["agreement.sent", "agreement.refused", "agreement.changes_requested"]);

    const target = (output: number) => {
      const nodes = nextOf(wf, router.name, output);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe("n8n-nodes-base.executeWorkflow");
      return (nodes[0].parameters.workflowId as { cachedResultName: string }).cachedResultName;
    };
    expect(target(0)).toMatch(/^W1 /);
    expect(target(1)).toMatch(/^W3 /);
    expect(target(2)).toMatch(/^W3 /);

    expect((router.parameters.options as { fallbackOutput: string }).fallbackOutput).toBe("extra");
    expect(wf.connections[router.name].main).toHaveLength(4);
    expect(reachable(wf, router.name, 3).some((node) => node.type === "n8n-nodes-base.executeWorkflow")).toBe(false);
  });

  test("C1035: no export contains $env, every notify URL starts with __SA_APP_BASE_URL__, every signer uses __SA_HMAC_SECRET__", () => {
    let notifyCount = 0;
    for (const file of FILES) {
      expect(raw(file), file).not.toContain("$env");
      const wf = load(file);
      for (const call of notifyNodes(wf)) {
        notifyCount += 1;
        expect(String(call.parameters.url).startsWith("__SA_APP_BASE_URL__"), `${file} ${call.name}`).toBe(true);
      }
      for (const signer of wf.nodes.filter((node) => node.type === "n8n-nodes-base.crypto")) {
        expect(signer.parameters.secret, `${file} ${signer.name}`).toBe("__SA_HMAC_SECRET__");
      }
    }
    expect(notifyCount).toBe(5);
  });

  test("C1035: the signature is checked before routing, over <X-SA-Timestamp>.<raw body> with __SA_HMAC_SECRET__, with the 300 s window", () => {
    const wf = load("events.json");
    const webhook = wf.nodes.find((node) => node.type === "n8n-nodes-base.webhook") as N8nNode;
    expect(webhook.parameters.options).toMatchObject({ rawBody: true });

    const crypto = wf.nodes.find((node) => node.type === "n8n-nodes-base.crypto") as N8nNode;
    expect(crypto.parameters).toMatchObject({ action: "hmac", type: "SHA256", encoding: "hex" });
    expect(crypto.parameters.value).toBe("={{ $('Events webhook').item.json.headers['x-sa-timestamp'] }}.{{ $json.rawBody }}");
    // A placeholder the operator replaces in n8n after import (plan Landing 13); the export never holds the secret.
    expect(crypto.parameters.secret).toBe("__SA_HMAC_SECRET__");

    const gate = wf.nodes.find((node) => node.type === "n8n-nodes-base.if") as N8nNode;
    const conditions = (gate.parameters.conditions as { combinator: string; conditions: { leftValue: string; rightValue: unknown; operator: { operation: string } }[] });
    expect(conditions.combinator).toBe("and");
    expect(conditions.conditions).toContainEqual(expect.objectContaining({
      leftValue: "={{ $('Events webhook').item.json.headers['x-sa-signature'] }}",
      rightValue: `=sha256={{ $json.${crypto.parameters.dataPropertyName} }}`,
      operator: expect.objectContaining({ operation: "equals" }),
    }));
    expect(conditions.conditions).toContainEqual(expect.objectContaining({
      leftValue: expect.stringContaining("Math.abs($now.toSeconds() - Number($('Events webhook').item.json.headers['x-sa-timestamp']))"),
      rightValue: 300,
      operator: expect.objectContaining({ operation: "lte" }),
    }));

    // Order: webhook, then the crypto node, then the gate, then the router; the router is reached only on true.
    expect(reachable(wf, webhook.name, 0).map((node) => node.name)).toEqual(expect.arrayContaining([crypto.name, gate.name]));
    expect(reachable(wf, crypto.name, 0).map((node) => node.name)).toContain(gate.name);
    const router = wf.nodes.find((node) => node.type === "n8n-nodes-base.switch") as N8nNode;
    expect(reachable(wf, gate.name, 0).map((node) => node.name)).toContain(router.name);
    expect(reachable(wf, gate.name, 1).some((node) => node.type === "n8n-nodes-base.executeWorkflow" || node.type === "n8n-nodes-base.switch")).toBe(false);
    expect(reachable(wf, router.name, 0).map((node) => node.name)).not.toContain(crypto.name);
  });
  const dayWait = (amount: number) => (wf: Workflow) =>
    wf.nodes.find((node) => node.type === "n8n-nodes-base.wait" && node.parameters.unit === "days" && node.parameters.amount === amount);
  const theEnd = () => undefined;
  const CALLS = [
    ["W1-agreement-sent.json", 0, "link", dayWait(3)],
    ["W1-agreement-sent.json", 1, "day3", dayWait(4)],
    ["W1-agreement-sent.json", 2, "day7", theEnd],
    ["W3-agreement-decided.json", 0, "W3", theEnd],
    ["W5-stale-daily.json", 0, "W5", theEnd],
  ] as const;

  describe.each(CALLS)("C1052: notify call %s #%i (%s)", (file, index, _label, nextStep) => {
    const wf = load(file);
    const call = notifyNodes(wf)[index];
    const expectedExit = nextStep(wf)?.name ?? null;

    test.each([200, 400, 401, 404, 422, 429, 501])("C1052: a %i is read without failing the run and never loops", (status) => {
      const run = runCall(wf, call, [status]);
      expect(run.failed).toBe(false);
      expect(run.calls).toBe(1);
      expect(run.tenMinuteWaits).toBe(0);
      expect(run.exit?.name ?? null).toBe(expectedExit);
    });

    test.each([[409], [500], [502], [503], [504], ["network" as const]])("C1052: a %s retries through a 10-minute Wait with the same key, freshly signed, until a 200", (answer) => {
      const run = runCall(wf, call, [answer, answer, 200]);
      expect(run.failed).toBe(false);
      expect(run.calls).toBe(3);
      expect(run.tenMinuteWaits).toBe(2);
      expect(run.keys).toHaveLength(3);
      expect(new Set(run.keys).size).toBe(1);
      expect(run.signedBeforeEachCall).toBe(true);
      expect(run.exit?.name ?? null).toBe(expectedExit);
    });

    test.each([[409], [500], [502], [503], [504], ["network" as const]])("C1052: a %s on every attempt stops after 6 retries, then W1 goes on and W3, W5 end", (answer) => {
      const run = runCall(wf, call, [answer]);
      expect(run.failed).toBe(false);
      expect(run.calls).toBe(7);
      expect(run.tenMinuteWaits).toBe(6);
      expect(run.exit?.name ?? null).toBe(expectedExit);
    });

    test("C1052: every pass takes a fresh X-SA-Timestamp from the clock and signs it with the body", () => {
      const signer = previousOf(wf, call.name)[0];
      const set = previousOf(wf, signer.name)[0];
      const timestamp = (set.parameters.assignments as { assignments: { name: string; value: string }[] }).assignments.find((a) => a.name === "timestamp")?.value;
      expect(timestamp).toMatch(/Date\.now\(\)|\$now/);
      expect(signer.parameters.value).toBe("={{ $json.timestamp }}.{{ $json.body }}");
    });
  });
});
