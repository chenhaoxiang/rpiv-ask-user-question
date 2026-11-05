// Execute trusted package source with actual Pi TUI primitives and a synthetic host.
// Not a security sandbox; no model, global settings or live user dialog.
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import * as tui from '@earendil-works/pi-tui';
import { Type } from 'typebox';
import { randomUUID } from 'node:crypto';
import { types } from 'node:util';
export const theme = { fg: (_c, x) => x, bg: (_c, x) => x, bold: x => x, strikethrough: x => x };
export async function loadSource(entry) {
  const context = createContext({ console, Intl, AbortController });
  const cache = new Map();
  const host = {
    'node:crypto': { randomUUID },
    'node:util': { types },
    '@earendil-works/pi-tui': tui,
    'typebox': { Type },
    '@earendil-works/pi-ai': { StringEnum: values => Type.Union(values.map(x => Type.Literal(x))) },
    '@earendil-works/pi-coding-agent': { DynamicBorder: class { render(w) { return ['─'.repeat(w)]; } invalidate() {} } },
  };
  async function get(url) {
    const key = url.href; if (cache.has(key)) return cache.get(key);
    const pending = (async () => {
    const m = new SourceTextModule(stripTypeScriptTypes(await readFile(url, 'utf8')), { context, identifier: key });
    await m.link(async (specifier, ref) => {
      if (specifier.startsWith('.')) return get(new URL(specifier.replace(/\.js$/, '.ts'), ref.identifier));
      const values = host[specifier]; if (!values) throw new Error(`Unexpected fixture import ${specifier}`);
      return new SyntheticModule(Object.keys(values), function () {
        for (const [k,v] of Object.entries(values)) this.setExport(k,v);
      }, { context });
    });
    return m;
    })();
    cache.set(key, pending);
    return pending;
  }
  const m = await get(entry); await m.evaluate(); return m.namespace;
}
export async function questionHarness(options = {}) {
  const api = await loadSource(new URL('../../ask-user-question.ts', import.meta.url));
  let tool, component, finish, renders = 0;
  const notices = [], events = [], hooks = new Map();
  api.registerAskUserQuestionTool({ registerTool: x => { tool = x; }, on: (name, handler) => {
    if (options.registrationError) throw Error('observer registration unavailable');
    hooks.set(name, handler); return () => hooks.delete(name);
  }, events: { emit: (name, data) => { const value = JSON.parse(JSON.stringify(data)); events.push({ name, data: value }); options.onEvent?.(name, value); } } });
  const ctx = { mode: "tui", hasUI: true, ui: {
    notify: (message, level) => notices.push({ message, level }),
    custom: factory => new Promise(resolve => {
      finish = resolve;
      component = factory({ requestRender: () => renders++ }, theme, {}, resolve);
    }),
  } };
  if (options.sessionId) ctx.sessionManager = { getSessionId: () => options.sessionId };
  hooks.get('session_start')?.({}, ctx);
  return { tool, ctx, notices, events, hooks, get component() { return component; }, get renders() { return renders; }, finish: value => finish(value) };
}
