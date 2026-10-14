// Execute trusted package source with actual Pi TUI primitives and a synthetic host.
// Not a security sandbox; no model, global settings or live user dialog.
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import * as tui from '@earendil-works/pi-tui';
import { Type } from 'typebox';
export const theme = { fg: (_c, x) => x, bg: (_c, x) => x, bold: x => x, strikethrough: x => x };
export async function loadSource(entry) {
  const context = createContext({ console, Intl, AbortController });
  const cache = new Map();
  const host = {
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
export async function questionHarness() {
  const api = await loadSource(new URL('../../ask-user-question.ts', import.meta.url));
  let tool, component, finish, renders = 0;
  const notices = [];
  api.registerAskUserQuestionTool({ registerTool: x => { tool = x; } });
  const ctx = { mode: "tui", hasUI: true, ui: {
    notify: (message, level) => notices.push({ message, level }),
    custom: factory => new Promise(resolve => {
      finish = resolve;
      component = factory({ requestRender: () => renders++ }, theme, {}, resolve);
    }),
  } };
  return { tool, ctx, notices, get component() { return component; }, get renders() { return renders; }, finish: value => finish(value) };
}
