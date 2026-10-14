import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTick } from 'node:timers/promises';
import { questionHarness } from './helpers/source-vm.mjs';
const params={question:'Choose',options:[{label:'A'},{label:'B'}]};
test('question tool requests host sequential execution',async()=>{
 const h=await questionHarness();assert.equal(h.tool.executionMode,'sequential');
});
test('a bypassed concurrent call rejects instead of replacing the visible question',async()=>{
 const h=await questionHarness();const abort=new AbortController();
 const p1=h.tool.execute('first',params,abort.signal,undefined,h.ctx);const firstComponent=h.component;
 const p2=h.tool.execute('second',params,abort.signal,undefined,h.ctx);
 let outcome;const observed=p2.then(value=>{outcome={value}},error=>{outcome={error}});
 await nextTick();const stillOriginal=h.component===firstComponent;
 abort.abort();await Promise.allSettled([p1,observed]);
 assert.ok(outcome?.error,'concurrent call must explicitly reject');assert.match(outcome.error.message,/already awaiting/);assert.ok(stillOriginal,'first UI must not be replaced');
});
test('normal answer, cancel and UI rejection release the per-registration guard',async()=>{
 for(const kind of ['answer','cancel','ui-error']){
  const h=await questionHarness();const original=h.ctx.ui.custom;
  if(kind==='ui-error')h.ctx.ui.custom=()=>Promise.reject(new Error('synthetic UI failure'));
  const p=h.tool.execute('one',params,undefined,undefined,h.ctx);
  if(kind==='ui-error')await assert.rejects(p,/synthetic UI failure/);else{h.component.handleInput(kind==='answer'?'\r':'\x1b');await p;}
  h.ctx.ui.custom=original;const second=h.tool.execute('two',params,undefined,undefined,h.ctx);h.component.handleInput('\r');assert.equal((await second).details.answer,'A');
 }
});
