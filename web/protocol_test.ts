import { assertEquals, assertRejects } from "@std/assert";
import suiteFile from "../protocol/cases.json" with { type: "json" };
import { createBridge, GawaError, PROTOCOL } from "./mod.ts";

type Reply = {
  gawa: number;
  id: number;
  result?: unknown;
  error?: { code: string; message?: string };
};
type NativeCase = {
  name: string;
  request?: {
    gawa?: number;
    id?: unknown;
    method?: string;
    params?: unknown;
    hello?: boolean;
  };
  reply: Reply | null;
};
type Suite = {
  native: NativeCase[];
  events: { event: string; data: unknown }[];
  page: {
    unavailableMethod: string;
    timeoutMs: number;
    timeoutMethod: string;
    ignore: unknown[];
  };
};

const suite = suiteFile as Suite;

function sameParams(actual: unknown, expected: unknown): boolean {
  const missing = (v: unknown) => v === undefined;
  if (missing(actual) || missing(expected)) {
    return missing(actual) && missing(expected);
  }
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function findCase(method: string, params: unknown): NativeCase | undefined {
  return suite.native.find((c) =>
    c.request?.method === method &&
    sameParams(c.request.params, params) &&
    c.reply !== null
  );
}

function fake(platform: "ios" | "android") {
  const sent: string[] = [];
  if (platform === "ios") {
    const g: Record<string, unknown> = {
      webkit: {
        messageHandlers: {
          gawa: {
            postMessage(body: string) {
              sent.push(body);
              const req = JSON.parse(body);
              const found = findCase(req.method, req.params);
              if (!found?.reply) return new Promise(() => {});
              const reply: Reply = { ...found.reply, id: req.id };
              return Promise.resolve(JSON.stringify(reply));
            },
          },
        },
      },
    };
    const emit = (event: string, data: unknown) =>
      // deno-lint-ignore no-explicit-any
      (g as any).__gawa.receive(
        JSON.stringify({ gawa: PROTOCOL, event, data }),
      );
    return { g, sent, emit };
  }
  const listeners: ((e: { data: string }) => void)[] = [];
  const dispatch = (data: string) =>
    queueMicrotask(() => listeners.forEach((fn) => fn({ data })));
  const g = {
    gawa: {
      postMessage(body: string) {
        sent.push(body);
        const req = JSON.parse(body);
        if (req.hello) return;
        const found = findCase(req.method, req.params);
        if (!found?.reply) return;
        dispatch(JSON.stringify({ ...found.reply, id: req.id }));
      },
      addEventListener(_type: string, fn: (e: { data: string }) => void) {
        listeners.push(fn);
      },
    },
  };
  const emit = (event: string, data: unknown) =>
    dispatch(JSON.stringify({ gawa: PROTOCOL, event, data }));
  return { g, sent, emit };
}

for (const platform of ["ios", "android"] as const) {
  Deno.test(`protocol fixtures: ${platform} page speaks the native cases`, async () => {
    for (const c of suite.native) {
      if (!c.request?.method || c.reply === null) continue;
      const { g, sent } = fake(platform);
      const bridge = createBridge({ global: g });
      const call = "params" in c.request
        ? bridge.call(c.request.method, c.request.params)
        : bridge.call(c.request.method);
      const reqs = sent.map((s) => JSON.parse(s)).filter((m) => m.method);
      const req = reqs.at(-1);
      assertEquals(req.gawa, 1, c.name);
      assertEquals(req.method, c.request.method, c.name);
      assertEquals(typeof req.id, "number", c.name);
      if ("params" in c.request) {
        assertEquals(req.params, c.request.params, c.name);
      } else assertEquals("params" in req, false, c.name);
      if (c.reply.error) {
        const err = await assertRejects(() => call, GawaError);
        assertEquals(err.code, c.reply.error.code, c.name);
        if (c.reply.error.message !== undefined) {
          assertEquals(err.message, c.reply.error.message, c.name);
        }
      } else {
        assertEquals(await call, c.reply.result ?? null, c.name);
      }
    }
  });

  Deno.test(`protocol fixtures: ${platform} delivers events`, async () => {
    const { g, emit } = fake(platform);
    const bridge = createBridge<
      { "app.version": () => string },
      { back: null }
    >({
      global: g,
    });
    for (const event of suite.events) {
      const got: unknown[] = [];
      const off = bridge.on(event.event as "back", (data) => got.push(data));
      emit(event.event, event.data);
      await new Promise((r) => setTimeout(r, 0));
      off();
      assertEquals(got, [event.data ?? null]);
    }
  });
}

Deno.test("protocol fixtures: android hello once", () => {
  const { g, sent } = fake("android");
  createBridge({ global: g });
  createBridge({ global: g });
  assertEquals(sent, [JSON.stringify({ gawa: PROTOCOL, hello: true })]);
});

Deno.test("protocol fixtures: no host is unavailable", async () => {
  const bridge = createBridge({ global: {} });
  const err = await assertRejects(
    () => bridge.call(suite.page.unavailableMethod),
    GawaError,
  );
  assertEquals(err.code, "unavailable");
});

Deno.test("protocol fixtures: timeout", async () => {
  const { g } = fake("ios");
  const bridge = createBridge({ global: g, timeout: suite.page.timeoutMs });
  const err = await assertRejects(
    () => bridge.call(suite.page.timeoutMethod),
    GawaError,
  );
  assertEquals(err.code, "timeout");
});

Deno.test("protocol fixtures: foreign messages are ignored", async () => {
  const { g } = fake("ios");
  const bridge = createBridge({ global: g });
  // deno-lint-ignore no-explicit-any
  const recv = (g as any).__gawa.receive;
  for (const noise of suite.page.ignore) {
    recv(typeof noise === "string" ? noise : JSON.stringify(noise));
  }
  assertEquals(await bridge.call("app.version"), "1.0");
});
