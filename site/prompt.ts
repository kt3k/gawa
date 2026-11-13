import { GITHUB } from "./base.ts";
import { highlight } from "./markdown.ts";

export const SPEC_URL = `${GITHUB}/blob/main/SPEC.md`;
export const CASES_URL = `${GITHUB}/blob/main/protocol/cases.json`;

/** Copy-paste prompt. The README and the getting-started page use the same text. */
export const AGENT_PROMPT = `Implement gawa according to the following spec:
${SPEC_URL}

Read that spec and implement the roles you need — page, router, and the iOS and/or Android profile, or another platform — so the result is compatible with the reference. Check it with protocol/cases.json as section 12 describes:
${CASES_URL}
`;

/** A code block with the same Copy button as other samples. */
export function promptBlock(): string {
  return `<div class="codeblock"><button type="button" class="copy" data-copy>Copy</button>${
    highlight(`${AGENT_PROMPT.trim()}\n`, undefined)
  }</div>`;
}
