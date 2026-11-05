import test from 'node:test';
import assert from 'node:assert/strict';
import { questionHarness } from './helpers/source-vm.mjs';
const channel='pi:work-question:v1';
const workRef={owner:'example/owner',kind:'task',key:'existing-task'};
const params={question:'PRIVATE_QUESTION',options:[{label:'PRIVATE_OPTION_A'},{label:'PRIVATE_OPTION_B'}]};
const rows=h=>h.events.filter(e=>e.name===channel).map(e=>e.data);

async function answer(h,extra={},choice={label:'PRIVATE_OPTION_A'}) {
  const pending=h.tool.execute('call_1|fc_x/1',{...params,...extra},undefined,undefined,h.ctx);
  h.finish(choice);return pending;
}

test('original UI identity and explicit work declaration produce three content-free observations',async()=>{
  const h=await questionHarness({sessionId:'native-session'});
  const result=await answer(h,{workRef,stageId:'design-decision'});
  assert.equal(result.details.answer,'PRIVATE_OPTION_A');
  const observations=rows(h);assert.deepEqual(observations.map(e=>e.phase),['opened','answer-received','closed']);
  assert.deepEqual(observations.map(e=>e.seq),[1,2,3]);assert.equal(new Set(observations.map(e=>e.epoch)).size,1);
  for(const e of observations){assert.equal(e.source,'ask_user_question');assert.equal(e.sessionId,'native-session');assert.equal(e.toolCallId,'call_1|fc_x/1');assert.deepEqual(e.workRef,workRef);assert.equal(e.stageId,'design-decision');assert.equal(e.workAssociation,'declared');assert.ok(Number.isSafeInteger(e.observedAt));}
  assert.equal(observations.at(-1).closeReason,'answered');
  const legacy=h.events.filter(e=>e.name==='pi:input-required').map(e=>e.data);
  assert.deepEqual(legacy,[{version:1,source:'ask_user_question',id:'call_1|fc_x/1',phase:'start'},{version:1,source:'ask_user_question',id:'call_1|fc_x/1',phase:'end'}]);
  const serialized=JSON.stringify(observations);for(const marker of ['PRIVATE_QUESTION','PRIVATE_OPTION_A','PRIVATE_OPTION_B','authorization','answer":','options','permission'])assert.ok(!serialized.includes(marker));
});

test('missing and malformed work metadata never blocks the original question or invents association',async()=>{
  const variants=[ [{},'unbound'],[{stageId:'alone'},'unavailable'],[{workRef:{...workRef,key:'../private'}},'unavailable'],[{workRef:{...workRef,owner:'ghp_'+ 'a'.repeat(30)}},'unavailable'],[{workRef,stageId:'x'.repeat(129)},'unavailable'],[{workRef:{...workRef,extra:true}},'unavailable'],[{workRef:null},'unavailable'],[{workRef:{...workRef,kind:'made-up'}},'unavailable'],[{workRef:{...workRef,owner:'a/b/c'}},'unavailable'],[{workRef:{...workRef,owner:'x'.repeat(257)}},'unavailable'] ];
  for(const [extra,state] of variants){const h=await questionHarness({sessionId:'native-session'});const result=await answer(h,extra);assert.equal(result.details.answer,'PRIVATE_OPTION_A');assert.equal(rows(h)[0].workAssociation,state);assert.equal(rows(h)[0].workRef,null);assert.equal(rows(h)[0].stageId,null);}
});

test('metadata getters/proxies are not invoked; a valid declaration is detached before waiting',async()=>{
  let traps=0;
  for(const work of [new Proxy({}, {get(){traps++;throw Error()},ownKeys(){traps++;throw Error()}}),Object.defineProperty({...workRef},'owner',{get(){traps++;throw Error()}})]){
    const h=await questionHarness({sessionId:'native-session'});await answer(h,{workRef:work});assert.equal(rows(h)[0].workAssociation,'unavailable');
  }
  assert.equal(traps,0);
  const h=await questionHarness({sessionId:'native-session'}),ref={...workRef};
  const pending=h.tool.execute('id',{...params,workRef:ref},undefined,undefined,h.ctx);ref.key='changed';h.finish({label:'PRIVATE_OPTION_A'});await pending;
  assert.ok(rows(h).every(e=>e.workRef.key==='existing-task'));
});

for(const [name,choice,reason,received] of [
 ['selection',{label:'PRIVATE_OPTION_A'},'answered',true],
 ['custom',{label:'PRIVATE_CUSTOM',isOther:true},'answered',true],
 ['multiple',{label:'PRIVATE_OPTION_A\nPRIVATE_OPTION_B',selectedIndices:[0,1]},'answered',true],
 ['chat',{label:'Chat about this',isChat:true},'chat',false],
 ['empty',{label:'',isOther:true},'empty',false],
 ['decline',null,'declined',false],
]) test(`native ${name} outcome is not inferred from legacy end`,async()=>{
  const h=await questionHarness({sessionId:'native-session'});await answer(h,{workRef},choice);
  assert.deepEqual(rows(h).map(e=>e.phase),received?['opened','answer-received','closed']:['opened','closed']);
  assert.equal(rows(h).at(-1).closeReason,reason);
});

test('abort and actual opened UI errors close once without claiming an answer',async()=>{
  const h=await questionHarness({sessionId:'native-session'}),abort=new AbortController();
  const pending=h.tool.execute('abort',params,abort.signal,undefined,h.ctx);abort.abort();assert.equal((await pending).details.answer,null);
  assert.deepEqual(rows(h).map(e=>e.phase),['opened','closed']);assert.equal(rows(h).at(-1).closeReason,'aborted');
  const failed=await questionHarness({sessionId:'native-session'});
  failed.ctx.ui.custom=factory=>{factory({requestRender(){}},{fg:(_c,v)=>v,bg:(_c,v)=>v,bold:v=>v,strikethrough:v=>v},{},()=>{});throw Error('PRIVATE_UI_ERROR')};
  await assert.rejects(failed.tool.execute('failure',params,undefined,undefined,failed.ctx));
  assert.deepEqual(rows(failed).map(e=>e.phase),['opened','closed']);assert.equal(rows(failed).at(-1).closeReason,'error');assert.ok(!JSON.stringify(rows(failed)).includes('PRIVATE_UI_ERROR'));
});

test('no UI, invalid options, pre-abort and pre-factory failure create no work-question interval',async()=>{
  const noUi=await questionHarness({sessionId:'native-session'});noUi.ctx.hasUI=false;await noUi.tool.execute('no-ui',params,undefined,undefined,noUi.ctx);assert.equal(rows(noUi).length,0);
  const empty=await questionHarness({sessionId:'native-session'});await empty.tool.execute('empty',{...params,options:[]},undefined,undefined,empty.ctx);assert.equal(rows(empty).length,0);
  const h=await questionHarness({sessionId:'native-session'}),controller=new AbortController();controller.abort();await h.tool.execute('pre',params,controller.signal,undefined,h.ctx);assert.equal(rows(h).length,0);
  h.ctx.ui.custom=()=>{throw Error('before factory')};await assert.rejects(h.tool.execute('failed',params,undefined,undefined,h.ctx));assert.equal(rows(h).length,0);
});

for(const lifecycle of ['session_start','session_tree']) test(`${lifecycle} reset fences old callbacks and starts a distinct epoch at seq1`,async()=>{
  const h=await questionHarness({sessionId:'native-session'});
  const pending=h.tool.execute('old',params,undefined,undefined,h.ctx),old=rows(h)[0];
  h.hooks.get(lifecycle)({},h.ctx);h.finish({label:'PRIVATE_OPTION_A'});assert.equal((await pending).details.answer,'PRIVATE_OPTION_A');
  assert.equal(rows(h).length,1); // no late answer/close in the replacement scope
  await answer(h);const fresh=rows(h).at(-3);assert.notEqual(fresh.epoch,old.epoch);assert.equal(fresh.seq,1);
  const waiting=h.tool.execute('shutdown',params,undefined,undefined,h.ctx);h.hooks.get('session_shutdown')();const count=rows(h).length;h.finish(null);await waiting;assert.equal(rows(h).length,count);
});

test('observer listener/registration failures preserve original UI and answer semantics',async()=>{
  const throwing=await questionHarness({sessionId:'native-session',onEvent(){throw Error('observer fault')}});assert.equal((await answer(throwing)).details.answer,'PRIVATE_OPTION_A');
  const missing=await questionHarness({sessionId:'native-session',registrationError:true});assert.equal((await answer(missing)).details.answer,'PRIVATE_OPTION_A');assert.equal(rows(missing).length,0);
});

test('unsafe native identities are not broadcast while legacy question behavior remains intact',async()=>{
  for(const id of ['/private/id','C:/123','../1','x'.repeat(513),'sk-'+ 'a'.repeat(40)]){
    const h=await questionHarness({sessionId:'native-session'});const pending=h.tool.execute(id,params,undefined,undefined,h.ctx);h.finish(null);await pending;assert.equal(rows(h).length,0);assert.equal(h.events.filter(e=>e.name==='pi:input-required').length,2);
  }
  for(const sessionId of ['/private/session','ghp_'+ 'a'.repeat(30)]) {const h=await questionHarness({sessionId});await answer(h);assert.equal(rows(h).length,0);}
  const valid=await questionHarness({sessionId:'native-session'});
  const pending=valid.tool.execute('call:provider|id/1/2',params,undefined,undefined,valid.ctx);valid.finish(null);await pending;
  assert.equal(rows(valid)[0].toolCallId,'call:provider|id/1/2');
});
