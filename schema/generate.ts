/**
 * Generate the example bridge types from schema/example.json.
 *
 *   deno run -A schema/generate.ts
 *
 * CI fails if the generated files drift from the schema.
 */
const schema = JSON.parse(
  await Deno.readTextFile(new URL("./example.json", import.meta.url)),
) as {
  methods: Method[];
  events: EventDef[];
};

type Field = { name: string; type: string };
type Method = {
  name: string;
  params: { name: string; fields: Field[] } | null;
  result: string;
  pageOnly?: boolean;
};
type EventDef = { name: string; data: string };

const tsType: Record<string, string> = {
  string: "string",
  int: "number",
  bool: "boolean",
  "string[]": "string[]",
  void: "void",
};
const swiftType: Record<string, string> = {
  string: "String",
  int: "Int",
  bool: "Bool",
  "string[]": "[String]",
  void: "Void",
};
const ktType: Record<string, string> = {
  string: "String",
  int: "Int",
  bool: "Boolean",
  "string[]": "List<String>",
  void: "Unit",
};

function map(
  table: Record<string, string>,
  type: string,
  where: string,
): string {
  const out = table[type];
  if (!out) throw new Error(`unknown type ${type} in ${where}`);
  return out;
}

const banner = (lang: string) =>
  `// Generated from schema/example.json by schema/generate.ts. Do not edit.\n`;

function ts(): string {
  const methods = schema.methods.map((m) => {
    const params = m.params
      ? `p: { ${
        m.params.fields.map((f) => `${f.name}: ${map(tsType, f.type, m.name)}`)
          .join("; ")
      } }`
      : "";
    return `  ${JSON.stringify(m.name)}: (${params}) => ${
      map(tsType, m.result, m.name)
    };`;
  });
  const events = schema.events.map((e) =>
    `  ${e.name}: ${map(tsType, e.data, e.name)};`
  );
  return `${banner("ts")}export type Methods = {\n${
    methods.join("\n")
  }\n};\n\nexport type Events = {\n${events.join("\n")}\n};\n`;
}

function swiftStruct(name: string, fields: Field[]): string {
  const body = fields.map((f) =>
    `    let ${f.name}: ${map(swiftType, f.type, name)}`
  ).join("\n");
  return `struct ${name}: Decodable {\n${body}\n}`;
}

function swift(): string {
  const structs = schema.methods
    .filter((m) => m.params && !m.pageOnly)
    .map((m) => swiftStruct(m.params!.name, m.params!.fields));
  return `${banner("swift")}import Foundation\n\n${structs.join("\n\n")}\n`;
}

function kotlin(): string {
  const classes = schema.methods
    .filter((m) => m.params && !m.pageOnly)
    .map((m) => {
      const fields = m.params!.fields.map((f) =>
        `val ${f.name}: ${map(ktType, f.type, m.params!.name)}`
      ).join(", ");
      return `@Serializable\ndata class ${m.params!.name}(${fields})`;
    });
  return `${
    banner("kt")
  }package io.github.kt3k.gawa.example\n\nimport kotlinx.serialization.Serializable\n\n${
    classes.join("\n\n")
  }\n`;
}

const root = new URL("..", import.meta.url);
await Deno.writeTextFile(new URL("examples/web/src/methods.ts", root), ts());
await Deno.writeTextFile(
  new URL("examples/ios/Sources/ExampleTypes.swift", root),
  swift(),
);
await Deno.writeTextFile(
  new URL(
    "examples/android/src/main/kotlin/io/github/kt3k/gawa/example/ExampleTypes.kt",
    root,
  ),
  kotlin(),
);
console.log("generated example bridge types");
