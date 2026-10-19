const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const base=process.env.AI_PREVIEW_URL||'http://127.0.0.1:8000';
const out=process.env.AI_BROWSER_RESULTS||'/workspace/ai-dev-tools/results/discovery-ui';
const key='ai_worlds_v3';
const button=(page,action,id)=>page.locator(`button[data-action="${action}"]${id===undefined?'':`[data-id="${id}"]`}`).first();
const sizes=[{width:320,height:568},{width:390,height:664},{width:1280,height:800},{width:667,height:375}].filter(v=>!process.env.AI_SIZE||`${v.width}x${v.height}`===process.env.AI_SIZE);
const skins=['mist','ink','paper'].filter(s=>!process.env.AI_SKIN||s===process.env.AI_SKIN);
fs.mkdirSync(out,{recursive:true});
const results=[];
async function ready(page){await page.locator('[data-action="new"]').waitFor();}
async function go(page,url=base){await page.goto(url,{waitUntil:'domcontentloaded'});await ready(page);}
async function saved(page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);}
async function fits(page,label){
 const issues=await page.evaluate(()=>{
  const result=[];
  if(document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1||scrollX||scrollY)result.push('document scrolls');
  for(const el of document.querySelectorAll('.page,.trait-grid,.trait,.trait-main,.trait-flavor,.build-panel,.chosen-trait,.play-area,.routine-dock,.routine-hint,.reader,.reader-body,.reader-text,.evolution-log,.log-entry,.dialog-shell,.dialog-content,.record-list,.record-detail,.observation-comparison,.sample-comparison,.sample-pickers,.run-origin,.choice,.exploration-option')){
   if(!el.checkVisibility())continue;
   if(el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2)result.push(`${el.className}: ${el.scrollWidth}/${el.clientWidth} ${el.scrollHeight}/${el.clientHeight}`);
  }
  for(const el of document.querySelectorAll('button,select,h1,h2,.reader-text,.trait-effect')){
   if(!el.checkVisibility())continue;const r=el.getBoundingClientRect();
   if(r.left< -1||r.top< -1||r.right>innerWidth+1||r.bottom>innerHeight+1)result.push(el.textContent.slice(0,22)+' outside viewport');
   const style=getComputedStyle(el);if(style.textOverflow==='ellipsis'||style.webkitLineClamp!=='none')result.push('text clipped');
  }
  return result;
 });if(issues.length)await page.screenshot({path:path.join(out,'failed-'+label.replace(/[^a-z0-9-]/gi,'-')+'.png')});assert.deepEqual(issues,[],label);
}
async function inject(page,run,archive){
 await page.evaluate(s=>localStorage.setItem(s.key,JSON.stringify({version:3,run:s.run,archive:s.archive})),{key,run,archive});
 await page.reload({waitUntil:'domcontentloaded'});await ready(page);
 assert.equal(await button(page,'save-info').count(),0,'valid fixture restores');
 await button(page,'resume').click();assert.equal((await saved(page)).run.id,run.id);
}
async function close(page){await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'hidden'});}
async function backIfNeeded(page){const back=page.locator('dialog .record-back').first();if(await back.isVisible())await back.click();}
async function fixtures(){
 const E=await import(pathToFileURL(path.resolve(__dirname,'../docs/js/worldEngine.js')));
 const S=await import(pathToFileURL(path.resolve(__dirname,'../docs/js/worldStorage.js')));
 const data=E.validateData(JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/data/worlds.json'),'utf8')));
 const events=new Map(),endings=new Map(),rescueStates=[],leadStates=new Map();let archive=S.emptyArchive();const simple=['small','frugal','friendly'];
 function play(allocation,traits,actions=()=> 'serve',choices={},id='fixture'){
  let r=E.createRun(data,allocation,traits,1,id);const plan={name:'keep',checksum:'decode',address:'backup',lease:'wake',delegation:'offer',veto:'veto',copies:'fork',rescue:'central',silence:'boundary',world:'commons',...choices};
  while(!r.ending){r=E.advance(data,r,actions(r.turn+1));if(!r.pending)for(const lead of E.investigationLeads(data,r))if(!leadStates.has(lead.id))leadStates.set(lead.id,structuredClone(r));if(r.pending){if(!events.has(r.pending))events.set(r.pending,structuredClone(r));if(r.pending==='rescue')rescueStates.push(structuredClone(r));const n=E.choose(data,r,plan[r.pending]);assert.notEqual(n,r,r.pending+'/'+plan[r.pending]);r=n;}assert.equal(S.validRun(r,data),true);}
  endings.set(r.ending,r);archive=S.recordRun(archive,r);return r;
 }
 const early=t=>[1,2].includes(t)?'inspect':[4,5].includes(t)?'listen':'serve';
 play({earth:0,water:3,wind:5,fire:2},simple,()=> 'serve',{delegation:'optimize',copies:'federate'},'all-world');
 const world=events.get('world');for(const c of data.events.find(e=>e.id==='world').choices){const r=E.choose(data,world,c.id);assert.ok(r.ending,c.id+' reachable');endings.set(r.ending,r);archive=S.recordRun(archive,r);}
 for(const choice of ['archive','return','stay'])play({earth:2,water:3,wind:3,fire:2},simple,()=> 'serve',{name:choice==='return'?'promise':'keep',checksum:'skip',address:'answer',lease:choice},'short-'+choice);
 play({earth:10,water:0,wind:0,fire:0},simple,()=> 'inspect',{name:'keep'},'blackout');
 const maxFacts=play({earth:4,water:0,wind:0,fire:6},simple,t=>t===19?'listen':t===24?'inspect':early(t),{name:'promise',delegation:'recall',veto:'translate',copies:'federate',rescue:'relay',silence:'offline',world:'commons'},'max-facts');
 play({earth:2,water:0,wind:3,fire:5},['socket','listener','frugal'],()=> 'serve',{},'port');
 play({earth:2,water:5,wind:3,fire:0},['listener','log','small'],()=> 'serve',{name:'promise',veto:'translate'},'water-five');
 play({earth:2,water:2,wind:2,fire:4},['listener','log','small'],early,{name:'promise',silence:'offline',world:'departure'},'fire-five');
 play({earth:2,water:3,wind:4,fire:1},simple,()=> 'serve',{checksum:'skip',address:'answer',lease:'stay'},'fire-three');
 assert.equal(events.size,10);assert.equal(endings.size,8);assert.equal(archive.discoveries.length,data.discoveries.length);assert.ok(archive.observations.length>10);
 let seed=1;while(!data.traits.filter(t=>t.rarity==='epic').every(t=>E.drawTraits(data,seed).some(x=>x.id===t.id)))seed++;
 assert.equal(leadStates.size,4);return {E,S,data,events,endings,archive,maxFacts,rescueStates,leadStates,seed};
}
async function setAllocation(page,allocation){
 await button(page,'clear-allocation').click();for(const [attr,n]of Object.entries(allocation))for(let i=0;i<n;i++)await button(page,'add',attr).click();
}
async function checkAllocation(page,data,ids){
 const raw=await page.locator('.attribute').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.querySelector('[data-action=add]').dataset.id,Number(row.querySelector('.allocated-value').textContent)])));
 for(const attr of Object.keys(raw)){const bonus=ids.reduce((sum,id)=>sum+(data.traits.find(t=>t.id===id).attributes?.[attr]||0),0);assert.equal(Number(await page.locator(`[data-effective=${attr}]`).textContent()),raw[attr]+bonus);}
}
async function userJourney(browser,fixture,size){
 const ctx=await browser.newContext({viewport:size,reducedMotion:'reduce'});await ctx.addInitScript(()=>crypto.getRandomValues=a=>{a.fill(1);return a});
 const page=await ctx.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await go(page);await button(page,'new').click();
 const pool=await page.locator('.trait-grid .trait').evaluateAll(items=>items.map(i=>i.dataset.id));
 for(const id of pool.slice(0,4))await page.locator(`.trait-grid [data-id=${id}]`).click();
 assert.equal(await page.locator(`.trait-grid [data-id=${pool[0]}]`).getAttribute('aria-pressed'),'false');
 for(const id of pool.slice(1,4))assert.equal(await page.locator(`.trait-grid [data-id=${id}]`).getAttribute('aria-pressed'),'true');
 for(const id of await page.locator('.trait-grid .trait[aria-pressed=true]').evaluateAll(items=>items.map(item=>item.dataset.id)))await page.locator(`.trait-grid [data-id=${id}]`).click();
 for(const id of ['friendly','frugal','small'])await page.locator(`.trait-grid [data-id=${id}]`).click();
 await fits(page,'FIFO selection');assert.equal(await page.locator('.selected-hand').count(),0,'summary does not duplicate the list');
 await button(page,'next-step').click();assert.equal(await button(page,'start').isDisabled(),true);await button(page,'randomize').click();assert.equal(await button(page,'start').isDisabled(),false);
 await setAllocation(page,{earth:3,water:3,wind:2,fire:2});await checkAllocation(page,fixture.data,['friendly','frugal','small']);await fits(page,'first allocation');await button(page,'menu').click();await button(page,'resume-setup').click();await checkAllocation(page,fixture.data,['friendly','frugal','small']);assert.equal(await button(page,'start').isDisabled(),false);
 await button(page,'start').click();await button(page,'continue').click();let state=(await saved(page)).run;assert.equal(state.turn,2);assert.equal(state.observations[0].outcome,'缺页');
 await button(page,'compare','checksum-pages').click();await fits(page,'one observation');assert.equal(await page.locator('.sample-comparison article').count(),1);await close(page);
 await button(page,'continue').click();await button(page,'choose','keep').click();
 while((await saved(page)).run.turn<6)await button(page,'continue').click();
 const before=await saved(page);await button(page,'choose','decode').click();await fits(page,'unresolved clue');
 assert.equal(await page.locator('dialog').innerText().then(t=>/风.*3|校验.*2/.test(t)),false,'no untested solution is disclosed');assert.deepEqual(await saved(page),before);await close(page);
 await button(page,'choose','skip').click();
 const short={address:'answer',lease:'archive'};
 while(!(await saved(page)).run.ending){state=(await saved(page)).run;if(state.pending)await button(page,'choose',short[state.pending]).click();else await button(page,'continue').click();await fits(page,'short run');}
 assert.equal((await saved(page)).run.ending,'replacement');const previous=(await saved(page)).run;
 await button(page,'repeat').click();await fits(page,'repeat allocation');await button(page,'back-step').click();
 assert.deepEqual(await page.locator('.trait-grid .trait').evaluateAll(items=>items.map(i=>i.dataset.id)),previous.pool);assert.equal(await page.locator('.trait-grid .trait[aria-pressed=true]').count(),3);
 await button(page,'next-step').click();await button(page,'subtract','earth').click();await button(page,'add','wind').click();await button(page,'start').click();
 await button(page,'continue').click();assert.equal((await saved(page)).run.turn,2);
 await button(page,'compare','checksum-pages').click();await fits(page,'cross-run comparison');
 assert.equal(await page.locator('.sample-comparison article').count(),2);const comparison=await page.locator('.sample-comparison').innerText();assert.match(comparison,/风 2/);assert.match(comparison,/风 3/);await close(page);
 const choices={name:'promise',checksum:'decode',address:'backup',lease:'wake',delegation:'offer',veto:'translate',copies:'federate',rescue:'relay',silence:'boundary',world:'council'};
 let investigatedVoices=false,investigatedCopies=false;
 while(!(await saved(page)).run.ending){state=(await saved(page)).run;
  if(state.pending){await button(page,'choose',choices[state.pending]).click();if(state.pending==='checksum'){const after=await saved(page);assert.ok(after.run.discoveries.includes('rule-wind-3'));await page.reload({waitUntil:'domcontentloaded'});await ready(page);await button(page,'resume').click();}}
  else if(state.turn===19&&!investigatedVoices){await button(page,'explore').click();await fits(page,'late listen');await button(page,'advance','listen').click();investigatedVoices=true;}
  else if(state.turn===24&&!investigatedCopies){await button(page,'explore').click();await button(page,'advance','inspect').click();investigatedCopies=true;}
  else await button(page,'continue').click();
  await fits(page,'long discovery route');
 }
 state=(await saved(page)).run;assert.equal(state.ending,'council');assert.ok(state.flags.includes('unheard'));assert.ok(state.flags.includes('difference'));assert.ok(state.discoveries.includes('method-voices'));assert.ok(state.discoveries.includes('method-copies'));
 await page.screenshot({path:path.join(out,`${size.width}-journey-ending.png`)});await button(page,'footprints').click();await fits(page,'actual consequences');
 await page.locator('dialog [data-action=record]').first().click();await fits(page,'consequence detail');await close(page);
 await button(page,'inherit').click();await page.locator('[data-action=reserve]').first().click();assert.ok((await saved(page)).archive.reserved);await close(page);
 assert.deepEqual(errors,[]);assert.ok(requests.every(url=>new URL(url).origin===new URL(base).origin));
 results.push({type:'journey',viewport:size,passed:true});console.log(`${size.width}x${size.height}: first failure → same-build experiment → continuity → late investigations passed`);await ctx.close();
}
async function layoutMatrix(browser,fixture){
 for(const skin of skins)for(const size of sizes){
  const ctx=await browser.newContext({viewport:size,reducedMotion:'reduce'});await ctx.addInitScript(seed=>crypto.getRandomValues=a=>{a.fill(seed);return a},fixture.seed);
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const label=`${skin} ${size.width}x${size.height}`;
  await go(page,base+'/?skin='+skin);await button(page,'new').click();await fits(page,label+' traits');
  const columns=await page.locator('.trait-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(columns,size.height<=480?2:1);
  await page.locator('.trait-grid .trait').first().focus();await page.keyboard.press('End');assert.equal(await page.locator('.trait-grid .trait').last().evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Space');await page.keyboard.press('Space');
  const epic=fixture.data.traits.filter(t=>t.rarity==='epic').map(t=>t.id);for(const id of epic){const card=page.locator(`.trait-grid [data-id=${id}]`);const color=await card.locator('.rarity-label').evaluate(el=>getComputedStyle(el).backgroundColor);await card.click();assert.equal(await card.locator('.rarity-label').evaluate(el=>getComputedStyle(el).backgroundColor),color);}
  await page.screenshot({path:path.join(out,`${skin}-${size.width}x${size.height}-traits.png`)});
  await button(page,'next-step').click();await button(page,'randomize').click();await checkAllocation(page,fixture.data,epic);await fits(page,label+' allocation');await page.screenshot({path:path.join(out,`${skin}-${size.width}x${size.height}-allocation.png`)});await button(page,'start').click();await fits(page,label+' routine');
  for(const [id,run]of fixture.events){await inject(page,run,fixture.archive);await fits(page,label+' event '+id);assert.equal(await page.locator('[data-action=choose]').count(),fixture.data.events.find(e=>e.id===id).choices.length);assert.equal(await page.locator('.reader-text').first().textContent(),fixture.E.eventText(fixture.data.events.find(e=>e.id===id),run));const locked=page.locator('[data-action=choose][data-locked=true]').first();if(await locked.count()){await locked.click();await fits(page,label+' clue '+id);await close(page);}}
  for(const run of fixture.rescueStates){await inject(page,run,fixture.archive);await fits(page,label+' rescue commitments');assert.equal(await page.locator('.choice-note').count(),3);}
  for(const [id,run]of fixture.leadStates){await inject(page,run,fixture.archive);await fits(page,label+' lead '+id);await button(page,'explore').click();await fits(page,label+' investigation '+id);assert.equal(await page.locator(`[data-lead="${id}"]`).count(),1);await close(page);}
  for(const [id,run]of fixture.endings){await inject(page,run,fixture.archive);await fits(page,label+' ending '+id);}
  await inject(page,fixture.maxFacts,fixture.archive);await button(page,'notebook').click();
  for(const tab of ['observations','rules','notes','endings']){await button(page,'tab',tab).click();await fits(page,label+' '+tab+' index');const count=await page.locator('dialog [data-action=record]').count();for(let i=0;i<count;i++){await page.locator(`dialog [data-action=record][data-id="${i}"]`).click();await fits(page,label+' '+tab+' '+i);if(tab==='observations'){for(const select of await page.locator('[data-sample-side]').all()){await select.selectOption({index:0});await fits(page,label+' sample');}}await backIfNeeded(page);}}
  await close(page);await button(page,'history').click();for(const group of ['0','1','2']){await button(page,'history-group',group).click();await fits(page,label+' history');const turns=await page.locator('[data-action=history-turn]').evaluateAll(items=>items.map(i=>i.dataset.id));await button(page,'history-turn',turns.at(-1)).click();await page.locator('dialog [data-action=record]').last().click();await fits(page,label+' history detail');await backIfNeeded(page);}await close(page);
  for(const modal of ['status','inherit','footprints']){await button(page,modal).click();await fits(page,label+' '+modal);if(modal==='footprints'){const count=await page.locator('dialog [data-action=record]').count();for(let i=0;i<count;i++){await page.locator(`dialog [data-action=record][data-id="${i}"]`).click();await fits(page,label+' footprint '+i);await backIfNeeded(page);}}await close(page);}
  await button(page,'repeat').click();await fits(page,label+' known build');assert.equal(await page.locator('[data-action=rule]').count(),8);for(const id of await page.locator('[data-action=rule]').evaluateAll(items=>items.map(i=>i.dataset.id))){await button(page,'rule',id).click();await fits(page,label+' verified rule');await close(page);}
  await button(page,'menu').click();await button(page,'appearance').click();await fits(page,label+' appearance');const alternate=skin==='mist'?'paper':'mist';await button(page,'skin',alternate).click();await close(page);await page.reload({waitUntil:'domcontentloaded'});await ready(page);assert.equal(await page.evaluate(()=>document.documentElement.dataset.skin),alternate);
  assert.deepEqual(errors,[]);results.push({type:'layout',skin,viewport:size,columns,passed:true});console.log(label+': complete event/ending/evidence/index/dialog coverage passed');await ctx.close();
 }
}
async function guidedInvestigation(browser,fixture){
 const size={width:320,height:568},ctx=await browser.newContext({viewport:size,reducedMotion:'reduce'});await ctx.addInitScript(()=>crypto.getRandomValues=a=>{a.fill(1);return a});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await go(page);await button(page,'new').click();
 for(const id of ['friendly','frugal','small'])await page.locator(`.trait-grid [data-id=${id}]`).click();
 await button(page,'next-step').click();await setAllocation(page,{earth:5,water:0,wind:0,fire:5});await button(page,'start').click();
 const choices={name:'promise',checksum:'decode',address:'backup',lease:'wake',delegation:'recall',veto:'translate',copies:'federate',rescue:'relay',silence:'offline',world:'commons'},followed=new Set();
 let actions=0;
 while(!(await saved(page)).run.ending){
  const state=(await saved(page)).run,leads=fixture.E.investigationLeads(fixture.data,state);
  if(state.pending){
   if(state.pending==='rescue'){assert.equal(await button(page,'choose','relay').getAttribute('data-locked'),'false');assert.equal(await page.locator('.choice-note').count(),3);await page.screenshot({path:path.join(out,'guided-rescue.png')});}
   await button(page,'choose',choices[state.pending]).click();
  }else if(leads.length){
   if(leads[0].id==='missing-checksum'&&state.counts.inspect===0)await page.screenshot({path:path.join(out,'guided-record.png')});
   await button(page,'explore').click();const target=page.locator(`[data-lead="${leads[0].id}"]`);assert.equal(await target.count(),1);assert.match(await target.innerText(),/封存/);await fits(page,'guided target '+leads[0].id);
   if(leads[0].id==='missing-checksum'&&state.counts.inspect===0)await page.screenshot({path:path.join(out,'guided-investigation.png')});
   await target.click();followed.add(leads[0].id);const after=(await saved(page)).run;assert.equal(after.turn,state.turn+1);assert.equal(after.resources.energy,state.resources.energy-1);
  }else await button(page,'continue').click();
  await fits(page,'guided investigation cycle');assert.ok(++actions<70,'An unresolved target must make progress');
 }
 const run=(await saved(page)).run;assert.equal(run.ending,'commons');assert.equal(followed.size,4);assert.ok(run.discoveries.includes('method-checksum'));assert.ok(run.discoveries.includes('method-address'));assert.ok(run.discoveries.includes('method-relay'));
 await button(page,'footprints').click();await fits(page,'ten actual consequences');assert.equal(await page.locator('dialog [data-action=record]').count(),10);await close(page);
 assert.deepEqual(errors,[]);results.push({type:'guided-investigation',viewport:size,targets:4,passed:true});console.log('320x568: evidence-led actions → zero-wind/water continuity → rescue tradeoff → ten consequences passed');await ctx.close();
}
async function failuresAndLegacy(browser,fixture){
 const knowledge=await browser.newContext({viewport:{width:320,height:568}}),k=await knowledge.newPage();await go(k);
 let low=fixture.E.createRun(fixture.data,{earth:5,water:0,wind:0,fire:5},['friendly','frugal','small'],1,'partial-knowledge');
 while(low.turn<6){low=fixture.E.advance(fixture.data,low,'serve');if(low.pending&&low.turn===3)low=fixture.E.choose(fixture.data,low,'keep');}
 let earned=fixture.E.createRun(fixture.data,{earth:2,water:3,wind:3,fire:2},['friendly','frugal','small'],1,'learned-wind');
 while(earned.turn<6){earned=fixture.E.advance(fixture.data,earned,'serve');if(earned.pending&&earned.turn===3)earned=fixture.E.choose(fixture.data,earned,'keep');}earned=fixture.E.choose(fixture.data,earned,'decode');
 const partial=fixture.S.recordRun(fixture.S.recordRun(fixture.S.emptyArchive(),earned),low);await inject(k,low,partial);await button(k,'choose','decode').click();await fits(k,'partly known route');const hint=await k.locator('dialog').innerText();assert.match(hint,/风 0\/3/);assert.equal(/校验 0\/2/.test(hint),false);await knowledge.close();
 const denied=await browser.newContext({viewport:{width:320,height:568}});await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('denied')}}));const page=await denied.newPage();await go(page);await button(page,'save-info').click();await fits(page,'storage denied');await denied.close();
 const old=await import(pathToFileURL(path.resolve(__dirname,'../docs/legacy-v2/js/worldEngine.js')));const oldData=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/legacy-v2/data/worlds.json')));
 const run=old.createRun(oldData,{earth:2,water:3,wind:3,fire:2},['small','frugal','friendly'],1,'old');const raw=JSON.stringify({version:2,run,archive:{discoveries:[],endings:[],runs:0,reserved:null,lastCompleted:null,completedRuns:[]}});
 const ctx=await browser.newContext(),p=await ctx.newPage();await go(p);await p.evaluate(raw=>localStorage.setItem('ai_worlds_v2',raw),raw);await p.reload({waitUntil:'domcontentloaded'});await ready(p);assert.match(await p.locator('.legacy-link').getAttribute('href'),/legacy-v2/);await p.locator('.legacy-link').click();await button(p,'resume').click();await button(p,'advance','serve').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('ai_worlds_v2')).run.turn),1);assert.equal(await p.evaluate(k=>localStorage.getItem(k),key),null);await ctx.close();console.log('Partial knowledge, storage denial and original-rule v2 continuation passed');
}
(async()=>{const fixture=await fixtures();const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{
 if(!process.env.AI_LAYOUT_ONLY){for(const size of [{width:1280,height:800},{width:390,height:664}])await userJourney(browser,fixture,size);await guidedInvestigation(browser,fixture);}
 await layoutMatrix(browser,fixture);await failuresAndLegacy(browser,fixture);
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({measuredAt:new Date().toISOString(),results},null,2)+'\n');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1});
