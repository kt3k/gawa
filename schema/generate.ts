/**
 * Generate bridge types from a gawa schema.
 *
 *   deno run -A schema/generate.ts
 *   deno run -A schema/generate.ts \
 *     --schema schema/host.json \
 *     --ts src/ui/host.gen.ts \
 *     --swift app/ios/Sources/HostTypes.swift \
 *     --kotlin app/android/app/src/main/kotlin/io/github/kt3k/shatranj/HostTypes.kt \
 *     --kotlin-package io.github.kt3k.shatranj
 *
 * With no arguments this reads schema/example.json and writes the example
 * apps. CI fails if those files drift.
 *
 * A type is `string`, `int`, `bool`, `void`, or `null`; `T[]`; or `T | null`.
 * `T` may be a named struct from `types`, or from a params/result object.
 * The same struct name is emitted once. Event `data: null` is payload-less.
 */
export type Field = { name: string; type: string };
export type StructRef = { name: string; fields?: Field[] };
export type Method = {
  name: string;
  params: StructRef | null;
  /** A type string, or a struct used as the result. */
  result: string | StructRef;
  pageOnly?: boolean;
};
export type EventDef = { name: string; data: string | null };
export type Schema = {
  types?: StructRef[];
  methods: Method[];
  events: EventDef[];
};

type Parsed = { base: string; array: boolean; nullable: boolean };
type Struct = {
  name: string;
  fields: Field[];
  decode: boolean;
  encode: boolean;
  native: boolean;
  alias: boolean;
};

const PRIMS = new Set(["string", "int", "bool", "void", "null"]);

export type GenerateOptions = {
  /** Shown in the generated banner. Default `schema/example.json`. */
  schemaLabel?: string;
  /** Kotlin `package` line. Default `io.github.kt3k.gawa.example`. */
  kotlinPackage?: string;
};

const DEFAULT_PACKAGE = "io.github.kt3k.gawa.example";

function parseType(raw: string, where: string): Parsed {
  let type = raw.trim();
  let nullable = false;
  if (type.endsWith(" | null")) {
    nullable = true;
    type = type.slice(0, -" | null".length).trim();
  }
  let array = false;
  if (type.endsWith("[]")) {
    array = true;
    type = type.slice(0, -2).trim();
  }
  if (!type || type.endsWith("[]") || type.includes("|")) {
    throw new Error(`unsupported type ${JSON.stringify(raw)} in ${where}`);
  }
  if (array && (type === "void" || type === "null")) {
    throw new Error(`unsupported type ${JSON.stringify(raw)} in ${where}`);
  }
  if (nullable && type === "void") {
    throw new Error(`unsupported type ${JSON.stringify(raw)} in ${where}`);
  }
  return { base: type, array, nullable };
}

function sameFields(a: Field[], b: Field[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function ident(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function render(p: Parsed, lang: "ts" | "swift" | "kt"): string {
  const base = {
    ts: {
      string: "string",
      int: "number",
      bool: "boolean",
      void: "void",
      null: "null",
    },
    swift: {
      string: "String",
      int: "Int",
      bool: "Bool",
      void: "Void",
      null: "Never",
    },
    kt: {
      string: "String",
      int: "Int",
      bool: "Boolean",
      void: "Unit",
      null: "Nothing",
    },
  }[lang][p.base as "string"] ?? p.base;
  let out = base;
  if (p.array) {
    out = lang === "ts"
      ? `${out}[]`
      : lang === "swift"
      ? `[${out}]`
      : `List<${out}>`;
  }
  if (p.nullable) out = lang === "ts" ? `${out} | null` : `${out}?`;
  return out;
}

type Use = {
  decode?: boolean;
  encode?: boolean;
  native?: boolean;
  alias?: boolean;
};

function compile(schema: Schema): Map<string, Struct> {
  const catalog = new Map<string, Field[]>();
  for (const t of schema.types ?? []) {
    if (!t.fields) throw new Error(`type ${t.name} has no fields`);
    if (catalog.has(t.name)) throw new Error(`duplicate type ${t.name}`);
    catalog.set(t.name, t.fields);
  }
  const structs = new Map<string, Struct>();
  const visiting = new Set<string>();

  function define(
    name: string,
    fields: Field[] | undefined,
    use: Use,
    where: string,
  ) {
    const known = catalog.get(name);
    const resolved = fields ?? known ?? structs.get(name)?.fields;
    if (!resolved) throw new Error(`unknown type ${name} in ${where}`);
    if (known && fields && !sameFields(known, fields)) {
      throw new Error(`type ${name} fields disagree with types[] in ${where}`);
    }
    const existing = structs.get(name);
    if (existing) {
      if (!sameFields(existing.fields, resolved)) {
        throw new Error(`type ${name} fields disagree in ${where}`);
      }
    } else {
      structs.set(name, {
        name,
        fields: resolved,
        decode: false,
        encode: false,
        native: false,
        alias: false,
      });
    }
    const s = structs.get(name)!;
    if (use.decode) s.decode = true;
    if (use.encode) s.encode = true;
    if (use.native) s.native = true;
    if (use.alias) s.alias = true;
    if (visiting.has(name)) return;
    visiting.add(name);
    for (const f of resolved) {
      const p = parseType(f.type, `${name}.${f.name}`);
      if (!PRIMS.has(p.base)) define(p.base, undefined, use, name);
    }
    visiting.delete(name);
  }

  function note(raw: string, where: string, use: Use): Parsed {
    const p = parseType(raw, where);
    if (!PRIMS.has(p.base)) {
      define(p.base, undefined, { ...use, alias: true }, where);
    }
    return p;
  }

  function resultType(
    result: string | StructRef,
    where: string,
    pageOnly: boolean,
  ): string {
    if (typeof result !== "string") {
      define(result.name, result.fields, {
        encode: true,
        native: !pageOnly,
        alias: true,
      }, where);
      return result.name;
    }
    return rawType(result, where, { encode: true, native: !pageOnly });
  }

  function rawType(raw: string, where: string, use: Use): string {
    note(raw, where, use);
    return raw;
  }

  for (const m of schema.methods) {
    if (m.params) {
      define(m.params.name, m.params.fields, {
        decode: true,
        native: !m.pageOnly,
        alias: !m.params.fields,
      }, m.name);
    }
    resultType(m.result, m.name, !!m.pageOnly);
  }
  for (const e of schema.events) {
    if (e.data !== null) {
      rawType(e.data, e.name, { encode: true, native: true });
    }
  }
  return structs;
}

function tsTypeOf(raw: string, where: string): string {
  return render(parseType(raw, where), "ts");
}

function banner(label: string): string {
  return `// Generated from ${label} by schema/generate.ts. Do not edit.\n`;
}

export function generate(
  schema: Schema,
  options: GenerateOptions = {},
): { ts: string; swift: string; kotlin: string } {
  const label = options.schemaLabel ?? "schema/example.json";
  const pkg = options.kotlinPackage ?? DEFAULT_PACKAGE;
  if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(pkg)) {
    throw new Error(`invalid Kotlin package ${JSON.stringify(pkg)}`);
  }
  const structs = compile(schema);
  const head = banner(label);

  const aliases = [...structs.values()].filter((s) => s.alias).map((s) => {
    const fields = s.fields.map((f) =>
      `${ident(f.name)}: ${tsTypeOf(f.type, s.name)}`
    ).join("; ");
    return `export type ${s.name} = { ${fields} };`;
  });

  const methods = schema.methods.map((m) => {
    const params = m.params
      ? `p: ${
        m.params.fields
          ? `{ ${
            m.params.fields.map((f) =>
              `${ident(f.name)}: ${tsTypeOf(f.type, m.name)}`
            ).join("; ")
          } }`
          : m.params.name
      }`
      : "";
    const result = typeof m.result === "string"
      ? tsTypeOf(m.result, m.name)
      : m.result.name;
    return `  ${JSON.stringify(m.name)}: (${params}) => ${result};`;
  });
  const events = schema.events.map((e) => {
    const data = e.data === null ? "null" : tsTypeOf(e.data, e.name);
    return `  ${ident(e.name)}: ${data};`;
  });
  const eventsBlock = events.length === 0
    ? "export type Events = Record<never, never>;\n"
    : `export type Events = {\n${events.join("\n")}\n};\n`;
  const aliasBlock = aliases.length ? `${aliases.join("\n")}\n\n` : "";
  const ts = `${head}${aliasBlock}export type Methods = {\n${
    methods.join("\n")
  }\n};\n\n${eventsBlock}`;

  const native = [...structs.values()].filter((s) => s.native);
  const swiftStructs = native.map((s) => {
    const proto = s.decode && s.encode
      ? "Codable"
      : s.encode
      ? "Encodable"
      : "Decodable";
    const body = s.fields.map((f) =>
      `    let ${f.name}: ${render(parseType(f.type, s.name), "swift")}`
    ).join("\n");
    return `struct ${s.name}: ${proto} {\n${body}\n}`;
  });
  const swift = `${head}import Foundation\n\n${
    swiftStructs.length ? `${swiftStructs.join("\n\n")}\n` : ""
  }`;

  const ktClasses = native.map((s) => {
    const fields = s.fields.map((f) =>
      `val ${f.name}: ${render(parseType(f.type, s.name), "kt")}`
    ).join(", ");
    return `@Serializable\ndata class ${s.name}(${fields})`;
  });
  const kotlin = ktClasses.length
    ? `${head}package ${pkg}\n\nimport kotlinx.serialization.Serializable\n\n${
      ktClasses.join("\n\n")
    }\n`
    : `${head}package ${pkg}\n`;

  return { ts, swift, kotlin };
}

type Cli = {
  schema: URL;
  ts: URL;
  swift: URL;
  kotlin: URL;
  kotlinPackage: string;
  schemaLabel: string;
};

function flag(argv: string[], i: number): string {
  const value = argv[i + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`missing value for ${argv[i]}`);
  }
  return value;
}

export function parseArgs(argv: string[], scriptUrl = import.meta.url): Cli {
  const schema = new URL("./example.json", scriptUrl);
  const cli: Cli = {
    schema,
    ts: new URL("../examples/web/src/methods.ts", scriptUrl),
    swift: new URL("../examples/ios/Sources/ExampleTypes.swift", scriptUrl),
    kotlin: new URL(
      "../examples/android/src/main/kotlin/io/github/kt3k/gawa/example/ExampleTypes.kt",
      scriptUrl,
    ),
    kotlinPackage: DEFAULT_PACKAGE,
    schemaLabel: "schema/example.json",
  };
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    const value = flag(argv, i);
    i++;
    if (name === "--schema") {
      cli.schema = new URL(value, `file://${Deno.cwd()}/`);
      cli.schemaLabel = value;
    } else if (name === "--ts") {
      cli.ts = new URL(value, `file://${Deno.cwd()}/`);
    } else if (name === "--swift") {
      cli.swift = new URL(value, `file://${Deno.cwd()}/`);
    } else if (name === "--kotlin") {
      cli.kotlin = new URL(value, `file://${Deno.cwd()}/`);
    } else if (name === "--kotlin-package") {
      cli.kotlinPackage = value;
    } else throw new Error(`unknown option ${name}`);
  }
  return cli;
}

if (import.meta.main) {
  const cli = parseArgs(Deno.args);
  const schema = JSON.parse(await Deno.readTextFile(cli.schema)) as Schema;
  const out = generate(schema, {
    schemaLabel: cli.schemaLabel,
    kotlinPackage: cli.kotlinPackage,
  });
  await Deno.writeTextFile(cli.ts, out.ts);
  await Deno.writeTextFile(cli.swift, out.swift);
  await Deno.writeTextFile(cli.kotlin, out.kotlin);
  console.log("generated example bridge types");
}
