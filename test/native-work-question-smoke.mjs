import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {join,isAbsolute,normalize} from 'node:path';
import {pathToFileURL} from 'node:url';
// Explicit, isolated SDK + synthetic custom-UI factory. No model prompt or real dialog.
const [sdk,entry,root]=process.argv.slice(2);
for(const value of [sdk,entry,root])assert.ok(typeof value==='string'&&isAbsolute(value)&&normalize(value)===value);
assert.equal(process.env.HOME,root);assert.equal(process.env.PI_CODING_AGENT_DIR,join(root,'agent'));
const api=await import(pathToFileURL(join(sdk,'dist/index.js')));
const cwd=join(root,'project'),agentDir=join(root,'agent');await mkdir(cwd,{recursive:true});await mkdir(agentDir,{recursive:true});
const runtime=await api.ModelRuntime.create({modelsPath:null,allowModelNetwork:false,refreshOnCreate:false,credentials:{async read(){},async list(){return[]},async modify(){assert.fail('credential write')},async delete(){assert.fail('credential delete')}},modelsStore:{async read(){},async write(){},async delete(){}}});
let providerCalls=0;for(const method of ['stream','streamSimple','complete','completeSimple'])runtime[method]=()=>{providerCalls++;throw Error('provider request forbidden')};
runtime.registerProvider('fixture',{api:'openai-completions',baseUrl:'http://127.0.0.1:1',apiKey:'synthetic',models:[{id:'fixture',name:'fixture',reasoning:true,input:['text'],contextWindow:8192,maxTokens:128,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}]});
const settings=api.SettingsManager.inMemory({compaction:{enabled:false},retry:{enabled:false},cacheWarming:'off',enableAnalytics:false,enableInstallTelemetry:false},{projectTrusted:false});
const events=api.createEventBus(),observations=[],legacy=[];events.on('pi:work-question:v1',x=>observations.push(x));events.on('pi:input-required',x=>legacy.push(x));
const lifecycle=[];
const loader=new api.DefaultResourceLoader({cwd,agentDir,settingsManager:settings,eventBus:events,additionalExtensionPaths:[entry],noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true,extensionFactories:[pi=>{
 pi.on('session_tree',e=>lifecycle.push({type:'session_tree'}));pi.on('session_shutdown',e=>lifecycle.push({type:'session_shutdown',reason:e.reason}));
}]});await loader.reload();assert.deepEqual(loader.getExtensions().errors,[]);
const manager=api.SessionManager.create(cwd,join(root,'sessions'));const {session}=await api.createAgentSession({cwd,agentDir,resourceLoader:loader,sessionManager:manager,settingsManager:settings,modelRuntime:runtime,model:runtime.getModel('fixture','fixture'),tools:['ask_user_question'],eventBus:events});
const theme={fg:(_c,s)=>s,bg:(_c,s)=>s,bold:s=>s,strikethrough:s=>s};let finish,component;
const uiContext={theme,notify(){},custom:factory=>new Promise(resolve=>{finish=resolve;component=factory({requestRender(){}},theme,{},resolve)})};
let sdkPromptCalls=0;session.prompt=async()=>{sdkPromptCalls++;throw Error('SDK prompt forbidden')};
const errors=[];try{
 await session.bindExtensions({mode:'tui',uiContext,onError:e=>errors.push(e)});
 const tool=session.agent.state.tools.find(t=>t.name==='ask_user_question');assert.ok(tool);
 const input={question:'PRIVATE_QUESTION',options:[{label:'PRIVATE_OPTION'}],workRef:{owner:'example/owner',kind:'task',key:'native-case'},stageId:'design'};
 const pending=tool.execute('call_1|fc_2/1',input,new AbortController().signal);assert.ok(component);assert.equal(observations.length,1);assert.equal(observations[0].phase,'opened');
 finish({label:'PRIVATE_OPTION'});const result=await pending;assert.equal(result.details.answer,'PRIVATE_OPTION');
 assert.deepEqual(observations.map(x=>x.phase),['opened','answer-received','closed']);assert.deepEqual(observations.map(x=>x.seq),[1,2,3]);assert.ok(observations.every(x=>x.sessionId===manager.getSessionId()&&x.toolCallId==='call_1|fc_2/1'));
 assert.equal(observations[0].workAssociation,'declared');assert.equal(observations[2].closeReason,'answered');assert.deepEqual(legacy.map(x=>x.phase),['start','end']);
 const target=manager.appendMessage({role:'user',content:'synthetic tree target',timestamp:Date.now()});
 manager.appendMessage({role:'user',content:'synthetic tree child',timestamp:Date.now()});
 const oldTree=tool.execute('tree-old',input,new AbortController().signal),treeEpoch=observations.at(-1).epoch,countBeforeTree=observations.length;
 await session.navigateTree(target,{summarize:false});assert.ok(lifecycle.some(e=>e.type==='session_tree'));
 finish({label:'PRIVATE_OPTION'});assert.equal((await oldTree).details.answer,'PRIVATE_OPTION');assert.equal(observations.length,countBeforeTree);
 const afterTree=tool.execute('tree-new',input,new AbortController().signal);assert.notEqual(observations.at(-1).epoch,treeEpoch);assert.equal(observations.at(-1).seq,1);finish(null);await afterTree;
 const oldReload=tool.execute('reload-old',input,new AbortController().signal),oldFinish=finish,oldEpoch=observations.at(-1).epoch,countBeforeReload=observations.length;
 await session.reload();assert.ok(lifecycle.some(e=>e.type==='session_shutdown'&&e.reason==='reload'));
 oldFinish({label:'PRIVATE_OPTION'});assert.equal((await oldReload).details.answer,'PRIVATE_OPTION');assert.equal(observations.length,countBeforeReload);
 const newTool=session.agent.state.tools.find(t=>t.name==='ask_user_question');assert.ok(newTool);
 const afterReload=newTool.execute('reload-new',input,new AbortController().signal);assert.notEqual(observations.at(-1).epoch,oldEpoch);assert.equal(observations.at(-1).seq,1);finish(null);await afterReload;
 const bytes=JSON.stringify(observations);for(const secret of ['PRIVATE_QUESTION','PRIVATE_OPTION',root])assert.ok(!bytes.includes(secret));assert.equal(providerCalls,0);assert.equal(sdkPromptCalls,0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({sdk:JSON.parse(await readFile(join(sdk,'package.json'),'utf8')).version,actualExtensionFactory:true,syntheticUI:true,workEvents:observations.length,legacyEvents:legacy.length,nativeIdentity:true,persistentSessionIdentity:!!manager.getSessionFile(),nativeTreeAndReloadFences:true,providerCalls,sdkPromptCalls}));
}finally{session.dispose()}
