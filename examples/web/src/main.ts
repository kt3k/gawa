/**
 * Example page shared by the iOS and Android example apps. It doubles as an
 * end-to-end test: it exercises the bridge, shows the results, and reports
 * them back to the app with the `report` method.
 */
import { createBridge, GawaError } from "../../../web/mod.ts";

type Methods = {
  echo: (p: { text: string }) => string;
  add: (p: { a: number; b: number }) => number;
  fail: () => void;
  missing: () => void;
  startTicks: (p: { count: number }) => void;
  report: (p: { ok: boolean; log: string[] }) => void;
};
type Events = { tick: number };

const bridge = createBridge<Methods, Events>({ timeout: 10_000 });
const log: string[] = [];

function out(line: string) {
  log.push(line);
  const li = document.createElement("li");
  li.textContent = line;
  document.getElementById("log")!.append(li);
}

function eq(actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${a} !== ${e}`);
}

async function rejects(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e) {
    if (e instanceof GawaError && e.code === code) return;
    throw new Error(`expected ${code}, got ${e}`);
  }
  throw new Error(`expected ${code}, got a result`);
}

async function check(name: string, fn: () => unknown): Promise<boolean> {
  try {
    await fn();
    out(`ok   ${name}`);
    return true;
  } catch (e) {
    out(`FAIL ${name}: ${(e as Error)?.message ?? e}`);
    return false;
  }
}

function ticks(count: number): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const got: number[] = [];
    const timer = setTimeout(() => {
      off();
      reject(new Error(`got only ${JSON.stringify(got)}`));
    }, 5_000);
    const off = bridge.on("tick", (n) => {
      got.push(n);
      if (got.length === count) {
        off();
        clearTimeout(timer);
        resolve(got);
      }
    });
    bridge.call("startTicks", { count }).catch(reject);
  });
}

async function run() {
  out(`platform: ${bridge.platform ?? "none (plain browser)"}`);
  const results = [
    await check("available", () => eq(bridge.available, true)),
    await check(
      "echo",
      async () =>
        eq(
          await bridge.call("echo", { text: "こんにちは 👋" }),
          "こんにちは 👋",
        ),
    ),
    await check(
      "add",
      async () => eq(await bridge.call("add", { a: 2, b: 3 }), 5),
    ),
    await check(
      "error from handler",
      () => rejects(bridge.call("fail"), "nope"),
    ),
    await check(
      "unknown method",
      () => rejects(bridge.call("missing"), "unknown_method"),
    ),
    await check("events", async () => eq(await ticks(3), [1, 2, 3])),
  ];
  const ok = results.every(Boolean);
  out(ok ? "ALL PASSED" : "SOME FAILED");
  document.body.dataset.result = ok ? "pass" : "fail";
  if (bridge.available) await bridge.call("report", { ok, log });
}

run();
