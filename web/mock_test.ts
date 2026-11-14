import { assertEquals, assertRejects } from "@std/assert";
import { createBridge, GawaError, installMock } from "./mod.ts";

type Methods = {
  "app.version": () => string;
  "kv.get": (p: { key: string }) => string | null;
};
type Events = { back: null };

Deno.test("installMock: answers calls and emits events", async () => {
  const g = {};
  const mock = installMock({
    global: g,
    handlers: {
      "app.version": () => "1.0",
      "kv.get": (p) => ((p as { key: string }).key === "lang" ? "ja" : null),
      "app.fail": () => {
        throw new GawaError("nope", "it failed");
      },
    },
  });
  const bridge = createBridge<Methods, Events>({ global: g });
  assertEquals(bridge.available, true);
  assertEquals(bridge.platform, "ios");
  assertEquals(await bridge.call("app.version"), "1.0");
  assertEquals(await bridge.call("kv.get", { key: "missing" }), null);
  const err = await assertRejects(
    () => bridge.call("missing" as "app.version"),
    GawaError,
  );
  assertEquals(err.code, "unknown_method");
  const fail = await assertRejects(
    () => bridge.call("app.fail" as "app.version"),
    GawaError,
  );
  assertEquals(fail.code, "nope");
  assertEquals(fail.message, "it failed");
  const got: unknown[] = [];
  bridge.on("back", (data) => got.push(data));
  mock.emit("back", null);
  assertEquals(got, [null]);
  assertEquals(mock.calls.map((c) => c.method), [
    "app.version",
    "kv.get",
    "missing",
    "app.fail",
  ]);
  assertEquals(await bridge.has("app.version"), true);
  assertEquals(await bridge.has("missing"), false);
  mock.uninstall();
});

Deno.test("installMock: legacyMethods makes has resolve null", async () => {
  const g = {};
  const mock = installMock({
    global: g,
    legacyMethods: true,
    handlers: { "app.version": () => "1.0" },
  });
  const bridge = createBridge<Methods>({ global: g });
  assertEquals(await bridge.has("app.version"), null);
  assertEquals(await bridge.call("app.version"), "1.0");
  mock.uninstall();
});

Deno.test("installMock: android host says hello and replies", async () => {
  const g = {};
  installMock({
    platform: "android",
    global: g,
    handlers: { "app.version": () => "1.0" },
  });
  const bridge = createBridge<Methods>({ global: g });
  assertEquals(bridge.platform, "android");
  assertEquals(await bridge.call("app.version"), "1.0");
});
