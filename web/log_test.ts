import { assertEquals, assertRejects } from "@std/assert";
import { createBridge, GawaError } from "./mod.ts";

Deno.test("log: records send, receive, and timeout", async () => {
  const lines: string[] = [];
  const g = {
    webkit: {
      messageHandlers: {
        gawa: {
          postMessage(body: string) {
            return Promise.resolve(JSON.stringify({
              gawa: 1,
              id: JSON.parse(body).id,
              result: "hi",
            }));
          },
        },
      },
    },
  };
  const bridge = createBridge<{ hello: () => string }>({
    global: g,
    log: (line) => lines.push(line),
  });
  assertEquals(await bridge.call("hello"), "hi");
  assertEquals(lines.some((l) => l.startsWith("send ")), true);
  assertEquals(lines.some((l) => l.startsWith("receive ")), true);

  const slow = {
    webkit: {
      messageHandlers: {
        gawa: { postMessage: () => new Promise(() => {}) },
      },
    },
  };
  const logged: string[] = [];
  const b2 = createBridge({
    global: slow,
    timeout: 20,
    log: (line) => logged.push(line),
  });
  const err = await assertRejects(() => b2.call("hello"), GawaError);
  assertEquals(err.code, "timeout");
  assertEquals(err.message.includes("hello #"), true);
  assertEquals(err.message.includes("no reply in 20ms"), true);
  assertEquals(logged.some((l) => l.startsWith("timeout hello #")), true);
});
