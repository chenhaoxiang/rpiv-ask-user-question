import test from 'node:test';
import assert from 'node:assert/strict';
import {questionHarness} from './helpers/source-vm.mjs';
const params={question:'Choose',options:[{label:'A'},{label:'B'}]};
for(const mode of ['rpc','json','print'])test(`unsupported ${mode} is an error without UI side effects`,async()=>{
 const h=await questionHarness();h.ctx.mode=mode;
 const r=await h.tool.execute('id',params,undefined,undefined,h.ctx);assert.equal(r.isError,true);assert.match(r.content[0].text,/UI not available/);assert.equal(r.details.answer,null);assert.equal(h.component,undefined);
});
test('TUI with no UI is a true error and does not reserve a question slot',async()=>{
 const h=await questionHarness();h.ctx.hasUI=false;
 const r=await h.tool.execute('id',params,undefined,undefined,h.ctx);assert.equal(r.isError,true);assert.equal(h.component,undefined);
 h.ctx.hasUI=true;const next=h.tool.execute('next',params,undefined,undefined,h.ctx);h.component.handleInput('\r');assert.equal((await next).details.answer,'A');
});
test('empty options is an error and does not open or reserve a UI',async()=>{
 const h=await questionHarness();const r=await h.tool.execute('id',{...params,options:[]},undefined,undefined,h.ctx);
 assert.equal(r.isError,true);assert.match(r.content[0].text,/No options/);assert.equal(r.details.answer,null);assert.equal(h.component,undefined);
 const next=h.tool.execute('next',params,undefined,undefined,h.ctx);h.component.handleInput('\r');assert.equal((await next).details.answer,'A');
});
for(const kind of ['select','decline','chat','custom-empty','abort'])test(`${kind} remains a normal answer/cancellation outcome`,async()=>{
 const h=await questionHarness();const a=new AbortController();const p=h.tool.execute('id',params,a.signal,undefined,h.ctx);
 if(kind==='select')h.component.handleInput('\r');
 if(kind==='decline')h.component.handleInput('\x1b');
 if(kind==='chat'){h.component.handleInput('\x1b[A');h.component.handleInput('\r');}
 if(kind==='custom-empty'){h.component.handleInput('\x1b[B');h.component.handleInput('\x1b[B');h.component.handleInput('\r');}
 if(kind==='abort')a.abort();const r=await p;assert.ok(!r.isError);
 if(kind==='decline'||kind==='abort')assert.equal(r.details.answer,null);
 if(kind==='chat')assert.equal(r.details.wasChat,true);
 if(kind==='custom-empty')assert.equal(r.details.wasCustom,true);
});
test('already aborted input remains cancellation even when UI/options would be invalid',async()=>{
 const h=await questionHarness();h.ctx.mode='rpc';const a=new AbortController();a.abort();
 const r=await h.tool.execute('id',{question:'fixture',options:[]},a.signal,undefined,h.ctx);assert.ok(!r.isError);assert.equal(r.content[0].text,'Question cancelled');assert.equal(h.component,undefined);
});
