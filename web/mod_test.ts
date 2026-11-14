import { assertEquals, assertRejects } from "@std/assert";
import { createBridge, GawaError, PROTOCOL } from "./mod.ts";

type Methods = {
  add: (p: { a: number; b: number }) => number;
  hello: () => string;
  fail: () => void;
};
type Events = { tick: number };

type Request = { gawa: number; id: number; method: string; params?: unknown };

/** A fake native router answering the test methods. */
function answer(req: Request) {
  const reply = (body: object) => ({ gawa: PROTOCOL, id: req.id, ...body });
  switch (req.method) {
    case "add": {
      const p = req.params as { a: number; b: number };
      return reply({ result: p.a + p.b });
    }
    case "hello":
      return reply({ result: "hi" });
    case "fail":
      return reply({ error: { code: "nope", message: "it failed" } });
    case "silent":
      return null;
    default:
      return reply({
        error: { code: "unknown_method", message: req.method },
      });
  }
}

/** Mimics WKScriptMessageHandlerWithReply. */
function fakeIOS() {
  const sent: string[] = [];
  const g: Record<string, unknown> = {
    webkit: {
      messageHandlers: {
        gawa: {
          postMessage(body: string) {
            sent.push(body);
            const reply = answer(JSON.parse(body));
            // A silent method never resolves.
            return reply
              ? Promise.resolve(JSON.stringify(reply))
              : new Promise(() => {});
          },
        },
      },
    },
  };
  const emit = (event: string, data: unknown) =>
    // deno-lint-ignore no-explicit-any
    (g as any).__gawa.receive(JSON.stringify({ gawa: PROTOCOL, event, data }));
  return { g, sent, emit };
}

/** Mimics the object injected by WebViewCompat.addWebMessageListener. */
function fakeAndroid() {
  const sent: string[] = [];
  const listeners: ((e: { data: string }) => void)[] = [];
  const dispatch = (data: string) =>
    queueMicrotask(() => listeners.forEach((fn) => fn({ data })));
  const g = {
    gawa: {
      postMessage(body: string) {
        sent.push(body);
        const req = JSON.parse(body);
        if (req.hello) return;
        const reply = answer(req);
        if (reply) dispatch(JSON.stringify(reply));
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

for (
  const [name, make] of [["ios", fakeIOS], ["android", fakeAndroid]] as const
) {
  Deno.test(`${name}: detects the host`, () => {
    const { g } = make();
    const b = createBridge<Methods, Events>({ global: g });
    assertEquals(b.available, true);
    assertEquals(b.platform, name);
  });

  Deno.test(`${name}: calls methods and gets results`, async () => {
    const { g, sent } = make();
    const b = createBridge<Methods, Events>({ global: g });
    assertEquals(await b.call("add", { a: 2, b: 3 }), 5);
    assertEquals(await b.call("hello"), "hi");
    const reqs = sent.map((s) => JSON.parse(s)).filter((r) => !r.hello);
    assertEquals(reqs[0], {
      gawa: 1,
      id: reqs[0].id,
      method: "add",
      params: { a: 2, b: 3 },
    });
    assertEquals("params" in reqs[1], false);
  });

  Deno.test(`${name}: native errors reject with GawaError`, async () => {
    const { g } = make();
    const b = createBridge<Methods, Events>({ global: g });
    const e = await assertRejects(() => b.call("fail"), GawaError, "it failed");
    assertEquals(e.code, "nope");
  });

  Deno.test(`${name}: delivers events until unsubscribed`, async () => {
    const { g, emit } = make();
    const b = createBridge<Methods, Events>({ global: g });
    const got: number[] = [];
    const off = b.on("tick", (n) => got.push(n));
    emit("tick", 1);
    emit("tick", 2);
    await new Promise((r) => setTimeout(r, 0));
    off();
    emit("tick", 3);
    await new Promise((r) => setTimeout(r, 0));
    assertEquals(got, [1, 2]);
  });

  Deno.test(`${name}: times out`, async () => {
    const { g } = make();
    const b = createBridge<{ silent: () => void }>({ global: g, timeout: 20 });
    const e = await assertRejects(() => b.call("silent"), GawaError);
    assertEquals(e.code, "timeout");
  });
}

Deno.test("android: says hello once so the app can send events", () => {
  const { g, sent } = fakeAndroid();
  createBridge({ global: g });
  createBridge({ global: g });
  assertEquals(sent, [JSON.stringify({ gawa: 1, hello: true })]);
});

Deno.test("no host: unavailable, calls reject", async () => {
  const b = createBridge<Methods>({ global: {} });
  assertEquals(b.available, false);
  assertEquals(b.platform, null);
  const e = await assertRejects(() => b.call("hello"), GawaError);
  assertEquals(e.code, "unavailable");
});

Deno.test("has: lists methods, and older shells resolve null", async () => {
  const listed = fakeIOS();
  const previous = listed.g.webkit as {
    messageHandlers: {
      gawa: { postMessage: (body: string) => Promise<string> };
    };
  };
  const post = previous.messageHandlers.gawa.postMessage;
  previous.messageHandlers.gawa.postMessage = (body: string) => {
    const req = JSON.parse(body);
    if (req.method === "gawa.methods") {
      return Promise.resolve(JSON.stringify({
        gawa: PROTOCOL,
        id: req.id,
        result: ["hello", "add"],
      }));
    }
    return post(body);
  };
  const listedBridge = createBridge<Methods>({ global: listed.g });
  assertEquals(await listedBridge.has("hello"), true);
  assertEquals(await listedBridge.has("missing"), false);

  const older = fakeIOS();
  const olderBridge = createBridge<Methods>({ global: older.g });
  assertEquals(await olderBridge.has("hello"), null);

  const none = createBridge<Methods>({ global: {} });
  assertEquals(await none.has("hello"), false);
});

Deno.test("ignores foreign and malformed messages", async () => {
  const { g } = fakeIOS();
  const b = createBridge<Methods, Events>({ global: g });
  // deno-lint-ignore no-explicit-any
  const recv = (g as any).__gawa.receive;
  recv("not json");
  recv(JSON.stringify({ gawa: 2, event: "tick", data: 1 }));
  recv(JSON.stringify({ id: 999, result: 1 }));
  assertEquals(await b.call("hello"), "hi");
});
