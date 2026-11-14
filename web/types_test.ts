/**
 * Type-level checks. `deno test` type-checks this file; the runtime body
 * only holds the calls so the types are exercised.
 *
 * The generic helper is the one shatranj needs: a key `K` and that method's
 * parameter, with no cast of `call`.
 */
import { createBridge } from "./mod.ts";

type HostMethods = {
  "files.save": (p: { name: string; mimeType: string; text: string }) => void;
  "share.link": (p: { url: string; title: string }) => void;
  "records.list": () => string[];
  "records.put": (p: { id: string; json: string }) => void;
  "records.delete": (p: { id: string }) => void;
  "files.takeOpened": () => { name: string; text: string }[];
};
type HostEvents = { "files.opened": null; ping: void; tick: number };

const host = createBridge<HostMethods, HostEvents>();

function callHost<K extends keyof HostMethods>(
  method: K,
  params: Parameters<HostMethods[K]>[0],
): Promise<unknown> {
  return host.call(method, params);
}

/** Not called. The body exists so `deno check` type-checks the calls. */
function typeOnly(): void {
  void callHost("files.save", {
    name: "a.pgn",
    mimeType: "application/x-chess-pgn",
    text: "*",
  });
  void callHost("records.list", undefined);
  host.on("files.opened", () => {});
  host.on("ping", () => {});
  host.on("tick", (n) => {
    const _n: number = n;
    void _n;
  });
  host.call("records.list");
  host.call("files.takeOpened");
  // @ts-expect-error files.save requires its parameter
  host.call("files.save");
  // @ts-expect-error records.list takes no parameter
  host.call("records.list", { id: "x" });
}

Deno.test("call and on accept shatranj's shapes", () => {
  void typeOnly;
});
