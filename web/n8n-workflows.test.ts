import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/** The n8n exports of outbox-dispatch door 8, read as data. */
const DIR = path.join(__dirname, "..", "automation", "n8n");
const FILES = ["events.json", "W1-agreement-sent.json", "W3-agreement-decided.json", "W5-stale-daily.json"];

type N8nNode = { name: string; type: string; parameters: Record<string, unknown>; credentials?: Record<string, unknown> };
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

  test("C1033: W1 waits 3 days, then 4 days, in that order", () => {
    const wf = load("W1-agreement-sent.json");
    const waits = wf.nodes.filter((node) => node.type === "n8n-nodes-base.wait");
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
});
