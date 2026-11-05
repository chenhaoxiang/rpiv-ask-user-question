import { randomUUID } from "node:crypto";
import { types } from "node:util";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export const WORK_QUESTION_EVENT = "pi:work-question:v1";
export type WorkQuestionCloseReason = "answered" | "declined" | "aborted" | "error" | "chat" | "empty";
type WorkRef = Readonly<{ owner: string; kind: "issue" | "change" | "task" | "document"; key: string }>;
type Association = Readonly<{ workAssociation: "declared" | "unbound" | "unavailable"; workRef: WorkRef | null; stageId: string | null }>;
const INVALID = Symbol("invalid metadata");
// Same known-signature boundary as pi-vista/core; not a general secret detector.
const KNOWN_CREDENTIAL = /(?:github_pat_[A-Za-z0-9_]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|sk-[A-Za-z0-9_-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/iu;
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return INVALID;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor ? Object.hasOwn(descriptor, "value") ? descriptor.value : INVALID : undefined;
}
function identifier(value: unknown, max = 128): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && /^[A-Za-z0-9_.-]+$/u.test(value)
    && value !== "." && value !== ".." && !KNOWN_CREDENTIAL.test(value);
}
function callId(value: unknown): value is string {
  // Native composed calls append /n to the original opaque provider call id.
  return typeof value === "string" && value.length > 0 && value.length <= 512
    && /^[A-Za-z0-9_.:|_-]+(?:\/[1-9][0-9]*)*$/u.test(value)
    && ![".", ".."].includes(value.split("/")[0]) && !/^[A-Za-z]:\//u.test(value) && !KNOWN_CREDENTIAL.test(value);
}
function association(params: unknown): Association {
  const raw = own(params, "workRef"), stage = own(params, "stageId");
  if (raw === undefined && stage === undefined) return Object.freeze({ workAssociation: "unbound", workRef: null, stageId: null });
  const unavailable = Object.freeze({ workAssociation: "unavailable" as const, workRef: null, stageId: null });
  if (!raw || typeof raw !== "object" || types.isProxy(raw) || Array.isArray(raw)) return unavailable;
  const keys = Reflect.ownKeys(raw);
  if (keys.length !== 3 || keys.some(key => typeof key !== "string" || !["owner", "kind", "key"].includes(key))) return unavailable;
  const owner = own(raw, "owner"), kind = own(raw, "kind"), key = own(raw, "key");
  if (typeof owner !== "string" || owner.length > 256 || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?$/u.test(owner)
    || owner.split("/").some(part => part === "." || part === "..") || KNOWN_CREDENTIAL.test(owner)
    || !["issue", "change", "task", "document"].includes(kind as string) || !identifier(key)
    || (stage !== undefined && !identifier(stage))) return unavailable;
  return Object.freeze({ workAssociation: "declared", workRef: Object.freeze({ owner, kind: kind as WorkRef["kind"], key }), stageId: typeof stage === "string" ? stage : null });
}
function nativeSession(ctx: ExtensionContext): string | undefined {
  try { const id = ctx.sessionManager.getSessionId(); return identifier(id) ? id : undefined; } catch { return undefined; }
}

/** Optional metadata observer, never a question/result store or an answer/permission API. */
export function createWorkQuestionObserver(pi: ExtensionAPI) {
  let epoch = "", sequence = 0, sessionId: string | undefined, live = false, disabled = false;
  const subscriptions: unknown[] = [];
  try {
    if (typeof pi.on !== "function") throw Error();
    const startScope = (_event: unknown, ctx: ExtensionContext) => {
      if (disabled) return;
      live = false;
      try { epoch = randomUUID(); sequence = 0; sessionId = nativeSession(ctx); live = true; } catch { epoch = ""; }
    };
    subscriptions.push(pi.on("session_start", startScope));
    subscriptions.push(pi.on("session_tree", startScope));
    subscriptions.push(pi.on("session_shutdown", () => { live = false; epoch = ""; }));
  } catch {
    disabled = true; live = false; epoch = "";
    for (const unsubscribe of subscriptions) { try { if (typeof unsubscribe === "function") unsubscribe(); } catch { /* optional observer */ } }
  }
  return Object.freeze({
    begin(toolCallId: string, params: unknown, ctx: ExtensionContext) {
      try {
        const id = nativeSession(ctx), capturedEpoch = epoch;
        if (!live || !id || id !== sessionId || !callId(toolCallId)) return undefined;
        const context = association(params); let opened = false, answered = false, closed = false;
        const emit = (phase: "opened" | "answer-received" | "closed", closeReason: WorkQuestionCloseReason | null = null) => {
          if (!live || capturedEpoch !== epoch || id !== sessionId) return;
          try {
            pi.events?.emit(WORK_QUESTION_EVENT, Object.freeze({ version: 1, source: "ask_user_question", sessionId: id,
              toolCallId, epoch: capturedEpoch, seq: ++sequence, phase, observedAt: Date.now(), ...context, closeReason }));
          } catch { /* Optional observers do not change native question outcomes. */ }
        };
        return Object.freeze({
          opened() { if (opened || closed) return; opened = true; emit("opened"); },
          answerReceived() { if (!opened || answered || closed) return; answered = true; emit("answer-received"); },
          closed(reason: WorkQuestionCloseReason) { if (!opened || closed) return; closed = true; emit("closed", reason); },
        });
      } catch { return undefined; }
    },
  });
}
