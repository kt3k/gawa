import { assertEquals, assertThrows } from "@std/assert";
import { generate, parseArgs, type Schema } from "./generate.ts";

const example = JSON.parse(
  await Deno.readTextFile(new URL("./example.json", import.meta.url)),
) as Schema;

Deno.test("example schema output stays compatible", async () => {
  const out = generate(example);
  const root = new URL("..", import.meta.url);
  assertEquals(
    out.ts,
    await Deno.readTextFile(new URL("examples/web/src/methods.ts", root)),
  );
  assertEquals(
    out.swift,
    await Deno.readTextFile(
      new URL("examples/ios/Sources/ExampleTypes.swift", root),
    ),
  );
  assertEquals(
    out.kotlin,
    await Deno.readTextFile(
      new URL(
        "examples/android/src/main/kotlin/io/github/kt3k/gawa/example/ExampleTypes.kt",
        root,
      ),
    ),
  );
});

const host: Schema = {
  types: [
    {
      name: "OpenedFile",
      fields: [
        { name: "name", type: "string" },
        { name: "text", type: "string" },
      ],
    },
    {
      name: "RecordId",
      fields: [{ name: "id", type: "string" }],
    },
  ],
  methods: [
    {
      name: "records.delete",
      params: { name: "RecordId" },
      result: "void",
    },
    {
      name: "records.get",
      params: { name: "RecordId" },
      result: "string | null",
    },
    {
      name: "files.takeOpened",
      params: null,
      result: "OpenedFile[]",
    },
    {
      name: "records.put",
      params: {
        name: "PutRecord",
        fields: [
          { name: "id", type: "string" },
          { name: "json", type: "string | null" },
        ],
      },
      result: "void",
    },
  ],
  events: [{ name: "files.opened", data: null }],
};

Deno.test("named types, nullability, arrays, and payload-less events", () => {
  const out = generate(host, { schemaLabel: "schema/host.json" });
  assertEquals(out.ts.includes("export type RecordId = { id: string };"), true);
  assertEquals(
    out.ts.includes(
      "export type OpenedFile = { name: string; text: string };",
    ),
    true,
  );
  assertEquals(
    out.ts.includes('"records.get": (p: RecordId) => string | null;'),
    true,
  );
  assertEquals(
    out.ts.includes('"files.takeOpened": () => OpenedFile[];'),
    true,
  );
  assertEquals(out.ts.includes('"files.opened": null;'), true);
  assertEquals(out.ts.includes("json: string | null"), true);
  assertEquals(out.ts.includes("Record<never, never>"), false);
  assertEquals(out.swift.split("struct RecordId").length - 1, 1);
  assertEquals(out.swift.includes("struct RecordId: Decodable"), true);
  assertEquals(out.swift.includes("struct OpenedFile: Encodable"), true);
  assertEquals(out.swift.includes("struct PutRecord: Decodable"), true);
  assertEquals(out.swift.includes("let json: String?"), true);
  assertEquals(out.kotlin.split("data class RecordId").length - 1, 1);
  assertEquals(
    out.kotlin.includes(
      "data class OpenedFile(val name: String, val text: String)",
    ),
    true,
  );
  assertEquals(
    out.kotlin.includes("package io.github.kt3k.gawa.example"),
    true,
  );
});

Deno.test("a struct used as a parameter and a result is emitted once", () => {
  const schema: Schema = {
    methods: [
      {
        name: "put",
        params: {
          name: "Item",
          fields: [{ name: "id", type: "string" }],
        },
        result: "void",
      },
      {
        name: "list",
        params: null,
        result: "Item[]",
      },
    ],
    events: [],
  };
  const out = generate(schema);
  assertEquals(out.swift.split("struct Item").length - 1, 1);
  assertEquals(out.swift.includes("struct Item: Codable"), true);
  assertEquals(out.kotlin.split("data class Item").length - 1, 1);
  assertEquals(
    out.ts.includes("export type Events = Record<never, never>;"),
    true,
  );
  assertEquals(out.ts.includes("export type Events = {"), false);
});

Deno.test("empty events pass deno lint", async () => {
  const out = generate({
    methods: [{ name: "ping", params: null, result: "void" }],
    events: [],
  });
  const file = await Deno.makeTempFile({ suffix: ".ts" });
  await Deno.writeTextFile(file, out.ts);
  const lint = await new Deno.Command(Deno.execPath(), {
    args: ["lint", file],
  }).output();
  if (!lint.success) {
    throw new Error(new TextDecoder().decode(lint.stderr));
  }
});

Deno.test("disagreeing struct fields are rejected", () => {
  assertThrows(() =>
    generate({
      methods: [
        {
          name: "a",
          params: { name: "Item", fields: [{ name: "id", type: "string" }] },
          result: "void",
        },
        {
          name: "b",
          params: { name: "Item", fields: [{ name: "n", type: "int" }] },
          result: "void",
        },
      ],
      events: [],
    })
  );
});

Deno.test("CLI paths and Kotlin package override the defaults", async () => {
  const dir = await Deno.makeTempDir();
  const schema = `${dir}/host.json`;
  await Deno.writeTextFile(
    schema,
    JSON.stringify({
      methods: [{ name: "ping", params: null, result: "void" }],
      events: [],
    }),
  );
  const ts = `${dir}/host.ts`;
  const swift = `${dir}/Host.swift`;
  const kt = `${dir}/Host.kt`;
  const run = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "-A",
      new URL("./generate.ts", import.meta.url).pathname,
      "--schema",
      schema,
      "--ts",
      ts,
      "--swift",
      swift,
      "--kotlin",
      kt,
      "--kotlin-package",
      "io.github.kt3k.shatranj",
    ],
    cwd: dir,
  }).output();
  if (!run.success) {
    throw new Error(new TextDecoder().decode(run.stderr));
  }
  const kotlin = await Deno.readTextFile(kt);
  assertEquals(kotlin.includes("package io.github.kt3k.shatranj"), true);
  assertEquals(
    (await Deno.readTextFile(ts)).includes("Record<never, never>"),
    true,
  );
  const defaults = parseArgs([]);
  assertEquals(defaults.schemaLabel, "schema/example.json");
  assertEquals(defaults.kotlinPackage, "io.github.kt3k.gawa.example");
});
