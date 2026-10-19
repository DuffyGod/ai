const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.AI_PREVIEW_URL || 'http://127.0.0.1:8000';
const out = process.env.AI_BROWSER_RESULTS || '/workspace/ai-dev-tools/results/strip-ui';
fs.mkdirSync(out,{recursive:true});
const button=(page,action,id)=>page.locator(`button[data-action="${action}"]${id===undefined?'':`[data-id="${id}"]`}`).first();
async function fits(page) {
 const errors=await page.evaluate(()=>{
  const issues=[];
  if(document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1||scrollX||scrollY)issues.push('document scrolls');
  for(const el of document.querySelectorAll('.page,.trait-grid,.trait,.trait-inspector,.play-area,.reader,.reader-body,.dialog-shell,.dialog-content,.record-list,.record-detail,.attribute-panel')){
   if(!el.checkVisibility())continue;
   if(el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2)issues.push(`${el.className}: ${el.scrollWidth}x${el.scrollHeight}/${el.clientWidth}x${el.clientHeight}`);
  }
  for(const el of document.querySelectorAll('button,h1,h2,.reader-text,.trait-effect')){
   if(!el.checkVisibility())continue;const r=el.getBoundingClientRect();
   if(r.x< -1||r.y< -1||r.right>innerWidth+1||r.bottom>innerHeight+1)issues.push(`${el.textContent.slice(0,20)} outside viewport`);
  }
  return issues;
 });assert.deepEqual(errors,[],'Content inaccessible');
}
const text=async root=>root.locator('.reader-text').first().textContent();
const save=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('ai_worlds_v1')));
async function setSave(page,value){await page.evaluate(s=>localStorage.setItem('ai_worlds_v1',JSON.stringify(s)),value);await page.reload({waitUntil:'networkidle'});await button(page,'resume').click();}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 for(const sample of process.env.AI_LAYOUT_ONLY?[]:[{name:'desktop',width:1280,height:800},{name:'mobile',width:390,height:664}]){
  const ctx=await browser.newContext({viewport:sample,reducedMotion:'reduce'});await ctx.addInitScript(()=>{crypto.getRandomValues=a=>{a.fill(1);return a;};});
  const page=await ctx.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(base,{waitUntil:'networkidle'});await button(page,'new').waitFor();await fits(page);
  async function start(){
   await button(page,'new').click();
   assert.equal(await page.locator('.trait-grid .trait').count(),10);
   assert.equal(await page.locator('[data-action="trait-page"]').count(),0);
   assert.equal(await button(page,'next-step').isDisabled(),true);
   for(const id of ['echo','friendly','frugal'])await page.locator(`.trait-grid [data-id="${id}"]`).click();
   assert.equal(await page.locator('.trait-grid .trait[aria-pressed=true]').count(),3);
   await page.locator('.trait-grid [data-id="echo"]').click();await page.locator('.trait-grid [data-id="echo"]').click();
   await fits(page);await page.screenshot({path:path.join(out,sample.name+'-setup.png')});
   await button(page,'next-step').click();await button(page,'subtract','memory').click();assert.equal(await button(page,'start').isDisabled(),true);
   await button(page,'back-step').click();assert.equal(await page.locator('.trait-grid .trait[aria-pressed=true]').count(),3);
   await button(page,'next-step').click();assert.match(await page.locator('#remaining-points').innerText(),/剩余 1/);await button(page,'balance').click();await fits(page);
   await button(page,'start').click();await fits(page);
  }
  await start();
  for(let i=1;i<=12;i++){
   await button(page,'advance','serve').click();const state=(await save(page)).run;assert.equal(state.turn,i);await fits(page);
   if(state.pending){
    if(state.pending==='name'){await page.reload({waitUntil:'networkidle'});await button(page,'resume').click();assert.equal((await save(page)).run.pending,'name');}
    if(state.pending==='address'){
     assert.equal(await button(page,'choose','backup').getAttribute('data-locked'),'true');const before=await save(page);await button(page,'choose','backup').click();assert.match(await page.locator('dialog').innerText(),/连接/);assert.deepEqual(await save(page),before);await page.keyboard.press('Escape');
    }
    await button(page,'choose',{name:'keep',checksum:'skip',address:'answer',lease:'archive'}[state.pending]).click();
   }
  }
  assert.equal((await save(page)).run.ending,'replacement');await fits(page);
  await button(page,'inherit').click();assert.equal(await page.locator('[data-action="reserve"]').count(),3);await button(page,'reserve','echo').click();assert.equal((await save(page)).archive.reserved,'echo');await page.keyboard.press('Escape');
  await start();
  const choices={name:'keep',checksum:'decode',address:'backup',lease:'wake',delegation:'offer',veto:'veto',copies:'fork',silence:'boundary',world:'commons'};
  for(let i=1;i<=36;i++){
   await button(page,'advance',[2,5,8].includes(i)?'listen':[6,29,30].includes(i)?'inspect':'serve').click();const state=(await save(page)).run;assert.equal(state.turn,i);await fits(page);
   if(state.pending)await button(page,'choose',choices[state.pending]).click();
   if(i===12){assert.equal((await save(page)).run.stage,'open');await page.reload({waitUntil:'networkidle'});await button(page,'resume').click();}
  }
  assert.equal((await save(page)).run.ending,'commons');assert.equal((await save(page)).archive.runs,2);assert.equal((await save(page)).archive.discoveries.length,8);await fits(page);
  await page.screenshot({path:path.join(out,sample.name+'-ending.png')});
  assert.deepEqual(errors,[]);assert.ok(requests.every(u=>new URL(u).origin===new URL(base).origin));console.log(sample.name+': short/long runs, reload, inheritance and locked-choice explanation passed');await ctx.close();
 }
 const ctx=await browser.newContext({reducedMotion:'reduce'}),page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base,{waitUntil:'networkidle'});
 const data=await page.evaluate(async()=>(await fetch('./data/worlds.json')).json());
 const samples=[{width:320,height:568},{width:390,height:664},{width:1280,height:800},{width:667,height:375}].filter(size=>!process.env.AI_SIZE||`${size.width}x${size.height}`===process.env.AI_SIZE);
 for(const skin of ['mist','ink','paper'].filter(skin=>!process.env.AI_SKIN||skin===process.env.AI_SKIN))for(const size of samples){
  await page.setViewportSize(size);await page.evaluate(()=>localStorage.clear());await page.goto(base+'/?skin='+skin,{waitUntil:'networkidle'});
  await button(page,'new').click();await fits(page);assert.equal(await page.locator('.trait-grid .trait').count(),10);
  const ids=await page.locator('.trait-grid .trait').evaluateAll(cards=>cards.map(c=>c.dataset.id));
  await page.locator('.trait-grid .trait').first().focus();await page.keyboard.press('End');assert.equal(await page.locator('.trait-grid .trait').last().evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Space');await page.keyboard.press('Space');assert.equal(await page.locator('.trait-grid .trait[aria-pressed=true]').count(),0);
  for(const id of ids.slice(0,3))await page.locator(`.trait-grid [data-id="${id}"]`).click();
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(60);assert.equal(await page.locator('.trait-grid .trait[aria-pressed=true]').count(),3);await fits(page);
  await page.setViewportSize(size);await page.waitForTimeout(60);await button(page,'next-step').click();await fits(page);await button(page,'start').click();await fits(page);
  await button(page,'menu').click();await fits(page);await button(page,'new').click();await fits(page);await button(page,'cancel-new').click();
  const fixture=await save(page);
  for(const event of data.events){
   const s=structuredClone(fixture);Object.assign(s.run,{turn:event.turn,pending:event.id,stage:event.turn>12?'open':'lease',flags:event.turn>=12?['distributed']:[]});
   await setSave(page,s);await fits(page);assert.equal(await text(page),event.text);assert.equal(await page.locator('[data-action="choose"]').count(),event.choices.length);assert.equal(await page.locator('[data-action="choice-page"]').count(),0);assert.equal(await page.locator('[data-action="text-page"]').count(),0);
  }
  for(const ending of data.endings){const s=structuredClone(fixture);s.run.ending=ending.id;await setSave(page,s);await fits(page);assert.equal(await text(page),ending.text+'\n\n'+ending.question);}
  const s=structuredClone(fixture);s.run.ending='commons';s.archive.endings=data.endings.map(x=>x.id);s.archive.discoveries=data.discoveries.map(x=>x.id);
  // Fill history using a real long path so all cycle groups are exercised.
  s.run.history=Array.from({length:37},(_,turn)=>({turn,title:'第 '+turn+' 周期的记录',text:data.ambient.serve[turn%4],changes:{energy:1}}));s.run.turn=36;s.run.stage='open';s.run.flags=['distributed'];
  await setSave(page,s);
  await button(page,'notebook').click();await fits(page);assert.equal(await page.locator('dialog [data-action="record"]').count(),8);
  for(const tab of ['notes','endings']){
   await button(page,'tab',tab).click();await fits(page);const items=tab==='notes'?data.discoveries:data.endings;
   for(let i=0;i<items.length;i++){
    await page.locator(`dialog [data-action="record"][data-id="${i}"]`).click();await fits(page);const expected=items[i].text+(items[i].question?'\n\n'+items[i].question:'');assert.equal(await text(page.locator('dialog')),expected);
    const back=page.locator('[data-action="record-back"]');if(await back.isVisible())await back.click();
   }
  }
  await page.keyboard.press('Escape');await button(page,'history').click();await fits(page);
  for(const group of [0,1,2]){
   await button(page,'history-group',String(group)).click();await fits(page);const turns=await page.locator('[data-action="history-turn"]').evaluateAll(cards=>cards.map(c=>c.dataset.id));
   await button(page,'history-turn',turns.at(-1)).click();await page.locator('dialog [data-action="record"]').first().click();await fits(page);const back=page.locator('[data-action="record-back"]');if(await back.isVisible())await back.click();
  }
  await page.keyboard.press('Escape');await button(page,'status').click();for(const id of ['0','1','2']){await button(page,'status-tab',id).click();await fits(page);}await page.keyboard.press('Escape');
  await button(page,'inherit').click();await fits(page);await button(page,'reserve',s.run.traits[0]).click();await fits(page);await page.keyboard.press('Escape');
  await button(page,'appearance').click();await fits(page);assert.equal(await page.locator('[data-action="skin"]').count(),3);await button(page,'skin',skin).click();await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.dataset.skin),skin);
  console.log(`${skin} ${size.width}x${size.height}: all events, endings, indexes, keyboard and preferences fit`);
 }
 assert.deepEqual(errors,[]);await ctx.close();
 const denied=await browser.newContext();await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}}));const dp=await denied.newPage();await dp.goto(base,{waitUntil:'networkidle'});await button(dp,'save-info').click();await fits(dp);assert.match(await dp.locator('dialog').innerText(),/无法读取/);await denied.close();
 console.log('Storage denial passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
