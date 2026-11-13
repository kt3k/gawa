// Generated from schema/example.json by schema/generate.ts. Do not edit.
export type Methods = {
  "echo": (p: { text: string }) => string;
  "add": (p: { a: number; b: number }) => number;
  "fail": () => void;
  "missing": () => void;
  "startTicks": (p: { count: number }) => void;
  "report": (p: { ok: boolean; log: string[] }) => void;
};

export type Events = {
  tick: number;
};
