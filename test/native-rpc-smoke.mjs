import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, normalize } from 'node:path';
import { createInterface } from 'node:readline';

// Opt-in native loader + real stdio RPC. No saved profile, login or model prompt.
const [sdk, entry, root] = process.argv.slice(2);
for (const value of [sdk, entry, root]) assert.ok(typeof value === 'string' && isAbsolute(value) && normalize(value) === value);
const cwd = join(root, 'project');
await mkdir(cwd, { recursive: true });
await mkdir(join(root, 'agent'), { recursive: true });
const fixture = join(root, 'rpc-fixture.ts');
await writeFile(fixture, `import register from ${JSON.stringify(entry)};
export default function (pi) {
  let tool;
  let providerRequests = 0;
  register(new Proxy(pi, { get(target, key) {
    if (key === 'registerTool') return value => { tool = value; pi.registerTool(value); };
    return Reflect.get(target, key);
  } }));
  pi.on('before_provider_request', () => { providerRequests++; throw Error('fixture forbids provider requests'); });
  pi.registerCommand('fixture-question', { handler: async (kind, ctx) => {
    const result = await tool.execute('rpc-fixture-' + kind, {
      question: 'Choose', options: [{label:'A',description:'first'}, {label:'A',description:'duplicate'}, {label:'B'}],
      multiSelect: kind === 'multi',
    }, new AbortController().signal, undefined, ctx);
    ctx.ui.notify('fixture-result:' + JSON.stringify({ kind, result, providerRequests }), 'info');
  } });
}
`);
const child = spawn(process.execPath, [join(sdk, 'dist/cli.js'), '--mode', 'rpc', '--no-session', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '-e', fixture, '--tools', 'ask_user_question'], {
  cwd,
  env: { HOME: root, PI_CODING_AGENT_DIR: join(root, 'agent'), PATH: process.env.PATH, TMPDIR: root, TERM: 'dumb', NO_COLOR: '1' },
  stdio: ['pipe', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', data => { stderr = (stderr + data).slice(-2000); });
const exit = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
const commands = new Map();
const results = [];
let nextId = 0;
let scenario;
let selections = [];
const send = value => child.stdin.write(JSON.stringify(value) + '\n');
const command = value => new Promise((resolve, reject) => {
  const id = String(++nextId);
  const timer = setTimeout(() => { commands.delete(id); reject(Error('RPC command deadline: ' + value.type)); }, 20000);
  commands.set(id, { resolve, reject, timer });
  send({ ...value, id });
});
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  let event;
  try { event = JSON.parse(line); } catch { return; }
  if (event.type === 'response') {
    const pending = commands.get(event.id);
    if (!pending) return;
    commands.delete(event.id);
    clearTimeout(pending.timer);
    if (!event.success) pending.reject(Error(event.error || 'RPC command failed'));
    else pending.resolve(event);
  }
  if (event.type !== 'extension_ui_request') return;
  if (event.method === 'notify' && event.message?.startsWith('fixture-result:')) {
    results.push(JSON.parse(event.message.slice('fixture-result:'.length)));
    return;
  }
  if (event.method === 'select') {
    const index = selections.shift();
    send(index === undefined
      ? { type: 'extension_ui_response', id: event.id, cancelled: true }
      : { type: 'extension_ui_response', id: event.id, value: event.options[index] });
  } else if (event.method === 'input') {
    send({ type: 'extension_ui_response', id: event.id, value: 'native custom 中文' });
  }
});
try {
  const state = await command({ type: 'get_state' });
  assert.ok(state.data.sessionId);
  const commandsResult = await command({ type: 'get_commands' });
  assert.ok(commandsResult.data.commands.some(command => command.name === 'fixture-question'));
  for (const [kind, indexes] of [['single', [1]], ['custom', [3]], ['chat', [4]], ['multi', [2, 0, 1, 3]], ['cancel', []]]) {
    scenario = kind;
    selections = indexes;
    const response = await command({ type: 'prompt', message: '/fixture-question ' + kind });
    assert.equal(response.data?.disposition, 'handled');
    const observed = results.find(result => result.kind === kind);
    assert.ok(observed, 'missing native result for ' + kind);
    assert.equal(observed.providerRequests, 0);
    assert.ok(!observed.result.isError);
  }
  assert.equal(results[0].result.details.answer, 'A');
  assert.equal(results[1].result.details.answer, 'native custom 中文');
  assert.equal(results[1].result.details.wasCustom, true);
  assert.equal(results[2].result.details.wasChat, true);
  assert.deepEqual(results[3].result.details.selectedIndices, [0, 1, 2]);
  assert.deepEqual(results[3].result.details.answers, ['A', 'A', 'B']);
  assert.equal(results[4].result.details.answer, null);
  console.log(JSON.stringify({ sdk: JSON.parse(await readFile(join(sdk, 'package.json'), 'utf8')).version, nativeRpc: true, nativeSessionId: state.data.sessionId, cases: results.map(result => result.kind), providerRequests: 0 }));
} catch (error) {
  throw new Error(`Native RPC fixture failed (${scenario || 'startup'}): ${error.message}\n${stderr}`);
} finally {
  for (const pending of commands.values()) { clearTimeout(pending.timer); pending.reject(Error('fixture closing')); }
  commands.clear();
  child.stdin.end();
  let timer;
  const observed = await Promise.race([exit, new Promise(resolve => { timer = setTimeout(() => resolve(undefined), 5000); })]);
  clearTimeout(timer);
  if (!observed) {
    child.kill('SIGKILL');
    const stopped = await exit;
    assert.equal(stopped.signal, 'SIGKILL');
    throw Error('RPC fixture needed forced shutdown');
  }
  lines.close();
}
