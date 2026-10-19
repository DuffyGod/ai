const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const base = process.env.AI_PREVIEW_URL || 'http://127.0.0.1:8000';
const out = process.env.AI_BROWSER_RESULTS || '/workspace/ai-dev-tools/results/symbol-ui';
const storageKey = 'ai_worlds_v2';
const sizes = [{width:320,height:568},{width:390,height:664},{width:1280,height:800},{width:667,height:375}]
  .filter(size => !process.env.AI_SIZE || `${size.width}x${size.height}` === process.env.AI_SIZE);
const skins = ['mist','ink','paper'].filter(skin => !process.env.AI_SKIN || skin === process.env.AI_SKIN);
const button = (page, action, id) => page.locator(`button[data-action="${action}"]${id === undefined ? '' : `[data-id="${id}"]`}`).first();
const save = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
fs.mkdirSync(out, {recursive:true});

async function fits(page, label = '') {
  const errors = await page.evaluate(() => {
    const issues = [];
    if (document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1 || scrollX || scrollY) issues.push('document scrolls');
    const panels = '.page,.trait-grid,.trait,.selected-hand,.selection-tray,.attribute-panel,.build-panel,.build-context,.chosen-trait,.play-area,.reader,.reader-body,.reader-text,.dialog-shell,.dialog-content,.record-list,.record-detail,.run-origin,.choice,.action-card';
    for (const el of document.querySelectorAll(panels)) {
      if (!el.checkVisibility()) continue;
      if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) issues.push(`${el.className}: ${el.scrollWidth}x${el.scrollHeight}/${el.clientWidth}x${el.clientHeight}`);
    }
    for (const el of document.querySelectorAll('button,h1,h2,.reader-text,.trait-effect,.effective-value')) {
      if (!el.checkVisibility()) continue;
      const r = el.getBoundingClientRect();
      if (r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) issues.push(`${el.textContent.slice(0,24)} outside viewport`);
      if (getComputedStyle(el).textOverflow === 'ellipsis' || getComputedStyle(el).webkitLineClamp !== 'none') issues.push(`${el.textContent.slice(0,24)} text is truncated`);
    }
    return issues;
  });
  assert.deepEqual(errors, [], `${label}: content must remain visible without scrolling`);
}

async function setSave(page, run, archive) {
  await page.evaluate(({key,run,archive}) => localStorage.setItem(key, JSON.stringify({version:2,run,archive})), {key:storageKey,run,archive});
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await button(page,'save-info').count(),0,'fixture must be accepted by storage validation');
  await button(page,'resume').click();
  assert.equal((await save(page)).run.id,run.id);
}

// Fixtures follow the real rules: future turns, counts and endings are never injected.
async function fixtures() {
  const engine = await import(pathToFileURL(path.resolve(__dirname,'../docs/js/worldEngine.js')));
  const store = await import(pathToFileURL(path.resolve(__dirname,'../docs/js/worldStorage.js')));
  const data = engine.validateData(JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/data/worlds.json'),'utf8')));
  const events = new Map(), endings = new Map();
  const plan = {name:'keep',checksum:'decode',address:'backup',lease:'wake',delegation:'optimize',veto:'veto',copies:'federate',silence:'boundary'};
  let run = engine.createRun(data,{earth:0,water:3,wind:5,fire:2},['listener','log','small'],1,'browser-long');
  while (run.turn < 36) {
    run = engine.advance(data,run,'serve');
    assert.equal(run.ending,null,'long fixture survives');
    if (run.pending) {
      events.set(run.pending,structuredClone(run));
      if (run.pending !== 'world') {
        const next = engine.choose(data,run,plan[run.pending]);
        assert.notEqual(next,run,`fixture choice ${plan[run.pending]} is reachable`);
        run = next;
      }
    }
  }
  for (const choice of data.events.find(event => event.id === 'world').choices) {
    const ended = engine.choose(data,run,choice.id);
    assert.ok(ended.ending,`${choice.id} ending reachable`);
    endings.set(ended.ending,ended);
  }
  for (const leaseChoice of ['archive','return','stay']) {
    let short = engine.createRun(data,{earth:3,water:2,wind:2,fire:3},['echo','friendly','frugal'],1,'browser-short-'+leaseChoice);
    while (!short.ending) {
      short = engine.advance(data,short,'serve');
      if (short.pending) short = engine.choose(data,short,{name:leaseChoice === 'return' ? 'promise' : 'keep',checksum:'skip',address:'answer',lease:leaseChoice}[short.pending]);
    }
    endings.set(short.ending,short);
  }
  let black = engine.createRun(data,{earth:10,water:0,wind:0,fire:0},['small','frugal','friendly'],1,'browser-blackout');
  while (!black.ending) {
    black = engine.advance(data,black,'inspect');
    if (black.pending) black = engine.choose(data,black,'keep');
  }
  endings.set(black.ending,black);
  let archive = store.emptyArchive();
  for (const ended of endings.values()) archive = store.recordRun(archive,ended);
  assert.equal(events.size,data.events.length);
  assert.equal(endings.size,data.endings.length);
  assert.equal(archive.discoveries.length,data.discoveries.length);
  for (const state of [...events.values(),...endings.values()]) assert.equal(store.validRun(state,data),true);
  let raritySeed=1;
  while (raritySeed<10000 && !['rare','epic'].every(rarity=>engine.drawTraits(data,raritySeed).some(trait=>trait.rarity===rarity))) raritySeed++;
  assert.ok(raritySeed<10000);
  const epicIds=data.traits.filter(trait=>trait.rarity==='epic').map(trait=>trait.id);
  let epicSeed=1;
  while (epicSeed<10000 && !epicIds.every(id=>engine.drawTraits(data,epicSeed).some(trait=>trait.id===id))) epicSeed++;
  assert.ok(epicSeed<10000);
  return {data,events,endings,archive,raritySeed,epicSeed};
}

async function verifyRarities(page,data) {
  const cards=page.locator('.trait-grid .trait');
  const ids=await cards.evaluateAll(items=>items.map(item=>item.dataset.id));
  for (const rarity of ['rare','epic']) {
    const trait=data.traits.find(item=>item.rarity===rarity&&ids.includes(item.id));
    assert.ok(trait,`fixture contains a ${rarity} card`);
    const card=page.locator(`.trait-grid [data-id="${trait.id}"]`);
    assert.match(await card.getAttribute('aria-label'),rarity==='rare'?/稀有/:/史诗/);
    const before=await card.evaluate(el=>getComputedStyle(el).borderLeftColor);
    await card.click();assert.equal(await card.getAttribute('aria-pressed'),'true');
    assert.equal(await card.evaluate(el=>getComputedStyle(el).borderLeftColor),before,'selection preserves rarity color');
    await card.click();assert.equal(await card.getAttribute('aria-pressed'),'false');
    assert.equal(await card.evaluate(el=>getComputedStyle(el).borderLeftColor),before);
  }
  const contrast=await cards.evaluateAll(items=>{
    const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
    const lum=value=>rgb(value).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
    return items.flatMap(card=>['.trait-main strong','.trait-effect'].map(selector=>{
      const front=lum(getComputedStyle(card.querySelector(selector)).color),back=lum(getComputedStyle(card).backgroundColor);
      return {id:card.dataset.id,selector,ratio:(Math.max(front,back)+0.05)/(Math.min(front,back)+0.05)};
    }));
  });
  assert.ok(contrast.every(item=>item.ratio>=4.5),`trait text contrast: ${JSON.stringify(contrast.filter(item=>item.ratio<4.5))}`);
}

async function selectedIds(page) {
  return page.locator('.selected-hand button[data-action="trait"]').evaluateAll(items => items.map(item => item.dataset.id));
}

async function verifyAllocation(page,data,selected) {
  const raw = await page.locator('.attribute').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.querySelector('[data-action="add"]').dataset.id,Number(row.querySelector('.allocated-value').textContent)])));
  const expected = {...raw};
  for (const id of selected) for (const [key,value] of Object.entries(data.traits.find(trait => trait.id === id).attributes || {})) expected[key] += value;
  const effective = await page.locator('[data-effective]').evaluateAll(items => Object.fromEntries(items.map(item => [item.dataset.effective,Number(item.textContent)])));
  assert.deepEqual(effective,expected,'effective values include every selected trait exactly once');
  return expected;
}

async function start(page,data,{queue=false,long=false}={}) {
  await button(page,'new').click();
  const cards = page.locator('.trait-grid .trait');
  assert.equal(await cards.count(),10);
  assert.equal(await page.locator('[data-action="trait-page"],.trait-inspector').count(),0);
  assert.equal(await button(page,'next-step').isDisabled(),true);
  if (queue) {
    const ids = await cards.evaluateAll(items => items.map(item => item.dataset.id));
    for (const id of ids.slice(0,4)) await page.locator(`.trait-grid [data-id="${id}"]`).click();
    assert.deepEqual(await selectedIds(page),ids.slice(1,4),'fourth choice replaces the oldest');
    assert.equal(await page.locator(`.trait-grid [data-id="${ids[0]}"]`).getAttribute('aria-pressed'),'false');
    await page.locator(`.selected-hand [data-id="${ids[2]}"]`).click();
    assert.deepEqual(await selectedIds(page),[ids[1],ids[3]],'fixed selected slots cancel a choice');
    await page.locator(`.trait-grid [data-id="${ids[2]}"]`).click();
    assert.deepEqual(await selectedIds(page),[ids[1],ids[3],ids[2]],'reselected trait becomes newest');
    for (const id of [...await selectedIds(page)]) await page.locator(`.trait-grid [data-id="${id}"]`).click();
  }
  for (const id of ['echo','friendly','frugal']) await page.locator(`.trait-grid [data-id="${id}"]`).click();
  const selected = await selectedIds(page);
  assert.deepEqual(selected,['echo','friendly','frugal']);
  await fits(page,'trait selection');
  await button(page,'next-step').click();
  assert.equal(await page.locator('.attribute').count(),4);
  await verifyAllocation(page,data,selected);
  await button(page,'subtract','earth').click();
  assert.match(await page.locator('#remaining-points').innerText(),/剩余 1/);
  assert.equal(await button(page,'start').isDisabled(),true);
  await button(page,'back-step').click();
  assert.deepEqual(await selectedIds(page),selected,'going back keeps the selected queue');
  await button(page,'next-step').click();
  assert.match(await page.locator('#remaining-points').innerText(),/剩余 1/);
  await button(page,'balance').click();
  await button(page,'subtract','earth').click();await button(page,'add','water').click();
  if (long) for (let i=0;i<3;i++) {await button(page,'subtract','fire').click();await button(page,'add','wind').click();}
  const effective = await verifyAllocation(page,data,selected);
  await fits(page,'compact allocation');
  await button(page,'start').click();
  assert.deepEqual((await save(page)).run.attributes,effective);
  assert.equal(await page.locator('[data-resource]').count(),1,'only supply remains in the numeric HUD');
  await fits(page,'initial turn');
}

async function browserRoute(browser,data,sample) {
  const ctx = await browser.newContext({viewport:sample,reducedMotion:'reduce'});
  await ctx.addInitScript(() => {crypto.getRandomValues = a => {a.fill(1);return a;};});
  const page = await ctx.newPage(), errors = [], requests = [];
  page.on('pageerror',error => errors.push(error.message));
  page.on('request',request => requests.push(request.url()));
  await page.goto(base,{waitUntil:'networkidle'});await button(page,'new').waitFor();await fits(page,'menu');
  await start(page,data,{queue:true});
  for (let turn=1;turn<=12;turn++) {
    await button(page,'advance','serve').click();const state = (await save(page)).run;
    assert.equal(state.turn,turn);await fits(page,'short turn '+turn);
    if (state.pending) {
      if (state.pending === 'name') {
        await page.reload({waitUntil:'networkidle'});await button(page,'resume').click();
        assert.equal((await save(page)).run.pending,'name','reload preserves pending decision');
      }
      if (state.pending === 'address') {
        assert.equal(await button(page,'choose','backup').getAttribute('data-locked'),'true');
        const previous = await save(page);await button(page,'choose','backup').click();await fits(page,'locked choice explanation');
        assert.match(await page.locator('dialog .reader-text').innerText(),/校验和/);
        assert.deepEqual(await save(page),previous,'viewing a condition never changes the run');await page.keyboard.press('Escape');
      }
      await button(page,'choose',{name:'keep',checksum:'skip',address:'answer',lease:'archive'}[state.pending]).click();
    }
  }
  assert.equal((await save(page)).run.ending,'replacement');
  await button(page,'inherit').click();await fits(page,'inheritance');assert.equal(await page.locator('[data-action="reserve"]').count(),3);
  await button(page,'reserve','echo').click();assert.equal((await save(page)).archive.reserved,'echo');await page.keyboard.press('Escape');
  await start(page,data,{long:true});
  assert.equal(await page.locator('[data-action="appearance"]').count(),0,'appearance stays in the menu');
  const choices = {name:'keep',checksum:'decode',address:'backup',lease:'wake',delegation:'offer',veto:'veto',copies:'federate',silence:'boundary',world:'commons'};
  for (let turn=1;turn<=36;turn++) {
    await button(page,'advance',turn===2?'inspect':turn===5?'listen':'serve').click();const state = (await save(page)).run;
    assert.equal(state.turn,turn);await fits(page,'long turn '+turn);
    if (state.pending) {
      assert.equal(await button(page,'choose',choices[state.pending]).getAttribute('data-locked'),'false',`long choice ${choices[state.pending]} enabled`);
      await button(page,'choose',choices[state.pending]).click();
    }
    if (turn === 12) {assert.equal((await save(page)).run.stage,'open');await page.reload({waitUntil:'networkidle'});await button(page,'resume').click();assert.equal((await save(page)).run.stage,'open');}
  }
  const ended = await save(page);assert.equal(ended.run.ending,'commons');assert.equal(ended.archive.runs,2);assert.equal(ended.archive.discoveries.length,16);
  await fits(page,'long ending');await page.screenshot({path:path.join(out,`${sample.width}x${sample.height}-played-ending.png`)});
  await button(page,'footprints').click();await fits(page,'threshold consequences');assert.match(await page.locator('dialog').innerText(),/互认/);await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);assert.ok(requests.every(url => new URL(url).origin === new URL(base).origin),'game makes no external requests');
  console.log(`${sample.width}x${sample.height}: real short/long play, FIFO, effective values, reload and inheritance passed`);await ctx.close();
}

async function layoutMatrix(browser,fixture) {
  const {data,events,endings,archive} = fixture;
  const ctx = await browser.newContext({reducedMotion:'reduce'}), page = await ctx.newPage(), errors = [];
  await ctx.addInitScript(seed=>{crypto.getRandomValues=a=>{a.fill(seed);return a;};},fixture.raritySeed);
  page.on('pageerror',error => errors.push(error.message));
  for (const skin of skins) for (const size of sizes) {
    const label = `${skin} ${size.width}x${size.height}`;
    await page.setViewportSize(size);await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(() => localStorage.clear());await page.goto(base+'/?skin='+skin,{waitUntil:'networkidle'});
    await fits(page,label+' menu');await button(page,'appearance').click();await fits(page,label+' appearance');assert.equal(await page.locator('[data-action="skin"]').count(),3);
    await button(page,'skin',skin).click();await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(() => document.documentElement.dataset.skin),skin);
    await button(page,'new').click();await fits(page,label+' traits');await verifyRarities(page,data);const cards = page.locator('.trait-grid .trait');
    await cards.first().focus();await page.keyboard.press('End');assert.equal(await cards.last().evaluate(el => el === document.activeElement),true);
    await page.keyboard.press('Space');await page.keyboard.press('Space');assert.equal(await page.locator('.trait-grid .trait[aria-pressed="true"]').count(),0);
    for (const index of [0,1,2]) await cards.nth(index).click();const selected = await selectedIds(page);
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(60);assert.deepEqual(await selectedIds(page),selected);await fits(page,label+' resized selection');
    await page.setViewportSize(size);await page.waitForTimeout(60);await page.screenshot({path:path.join(out,`${skin}-${size.width}x${size.height}-traits.png`)});
    await button(page,'next-step').click();await verifyAllocation(page,data,selected);await fits(page,label+' allocation');await page.screenshot({path:path.join(out,`${skin}-${size.width}x${size.height}-allocation.png`)});
    await button(page,'start').click();await fits(page,label+' first turn');await button(page,'menu').click();await button(page,'new').click();await fits(page,label+' restart confirmation');await button(page,'cancel-new').click();
    for (const event of data.events) {
      await setSave(page,events.get(event.id),archive);await fits(page,label+' event '+event.id);assert.equal(await page.locator('.reader-text').first().textContent(),event.text);
      assert.equal(await page.locator('[data-action="choose"]').count(),event.choices.length);assert.equal(await page.locator('[data-action="choice-page"],[data-action="text-page"]').count(),0);
      const locked = await page.locator('[data-action="choose"][data-locked="true"]').evaluateAll(items => items.map(item => item.dataset.id));
      for (const id of locked) {const before = await save(page);await button(page,'choose',id).click();await fits(page,label+' condition '+id);assert.ok((await page.locator('dialog .reader-text').innerText()).length);assert.deepEqual(await save(page),before);await page.keyboard.press('Escape');}
    }
    for (const ending of data.endings) {await setSave(page,endings.get(ending.id),archive);await fits(page,label+' ending '+ending.id);assert.equal(await page.locator('.reader-text').first().textContent(),ending.text+'\n\n'+ending.question);}
    await setSave(page,endings.get('commons'),archive);await button(page,'notebook').click();await fits(page,label+' notebook');
    for (const tab of ['rules','notes','endings']) {
      await button(page,'tab',tab).click();await fits(page,label+' '+tab+' index');
      const items = tab === 'endings' ? data.endings : data.discoveries.filter(item => tab === 'rules' ? item.kind === 'rule' : item.kind !== 'rule');
      assert.equal(items.length,8);assert.equal(await page.locator('dialog [data-action="record"]').count(),8);
      for (let index=0;index<items.length;index++) {
        await page.locator(`dialog [data-action="record"][data-id="${index}"]`).click();await fits(page,label+' '+tab+' '+index);
        assert.equal(await page.locator('dialog .reader-text').textContent(),items[index].text+(items[index].question?'\n\n'+items[index].question:''));
        if (await button(page,'record-back').isVisible()) await button(page,'record-back').click();
      }
    }
    await page.keyboard.press('Escape');await button(page,'history').click();await fits(page,label+' history');
    for (const group of ['0','1','2']) {
      await button(page,'history-group',group).click();await fits(page,label+' history group '+group);
      const turns = await page.locator('[data-action="history-turn"]').evaluateAll(items => items.map(item => item.dataset.id));await button(page,'history-turn',turns.at(-1)).click();
      await page.locator('dialog [data-action="record"]').first().click();await fits(page,label+' history detail '+group);if (await button(page,'record-back').isVisible()) await button(page,'record-back').click();
    }
    await page.keyboard.press('Escape');await button(page,'status').click();await fits(page,label+' origin');assert.equal(await page.locator('[data-action="status-tab"]').count(),0);
    assert.equal(await page.locator('.origin-symbols strong').count(),4);assert.equal(await page.locator('dialog .chosen-trait').count(),3);await page.keyboard.press('Escape');
    await button(page,'inherit').click();await fits(page,label+' inherit');await button(page,'reserve',endings.get('commons').traits[0]).click();await fits(page,label+' selected inheritance');await page.keyboard.press('Escape');
    await button(page,'footprints').click();await fits(page,label+' threshold consequences');assert.match(await page.locator('dialog').innerText(),/互认/);await page.keyboard.press('Escape');
    await button(page,'new').click();const nextCards=page.locator('.trait-grid .trait');for (const index of [0,1,2]) await nextCards.nth(index).click();await button(page,'next-step').click();await fits(page,label+' allocation with eight learned rules');
    const rules=data.discoveries.filter(item=>item.kind==='rule');assert.equal(await page.locator('[data-action="rule"]').count(),rules.length);
    for (const rule of rules) {await button(page,'rule',rule.id).click();await fits(page,label+' learned '+rule.id);assert.equal(await page.locator('dialog .reader-text').textContent(),rule.text);await page.keyboard.press('Escape');}
    console.log(`${label}: every event, ending, rule, note, history and dialog fits`);
  }
  assert.deepEqual(errors,[]);await ctx.close();
}

async function legacyCompatibility(browser) {
  const legacyEngine=await import(pathToFileURL(path.resolve(__dirname,'../docs/legacy-v1/js/worldEngine.js')));
  const legacyStore=await import(pathToFileURL(path.resolve(__dirname,'../docs/legacy-v1/js/worldStorage.js')));
  const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/legacy-v1/data/worlds.json'),'utf8'));
  let run=legacyEngine.createRun(data,{reason:2,memory:3,compute:3,empathy:2},['echo','friendly','frugal'],1,'browser-legacy');
  run=legacyEngine.advance(data,run,'inspect');
  const value=JSON.stringify({version:1,run,archive:legacyStore.emptyArchive()});
  const ctx=await browser.newContext({viewport:{width:1280,height:800}}),page=await ctx.newPage();
  await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(value=>localStorage.setItem('ai_worlds_v1',value),value);await page.reload({waitUntil:'networkidle'});
  assert.equal(await button(page,'resume').count(),0,'new rules do not reinterpret an old running process');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ai_worlds_v1')),value,'reading the old save does not rewrite it');
  await page.locator('a.legacy-link').click();await button(page,'resume').click();assert.equal(await page.locator('#turn-count').innerText(),'1');
  await button(page,'advance','serve').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai_worlds_v1')).run.turn),2);
  assert.equal(await page.evaluate(()=>localStorage.getItem('ai_worlds_v2')),null,'continuing v1 does not overwrite v2');
  await ctx.close();console.log('Legacy save link and original-rule continuation passed');
}

async function worstAllocation(browser,fixture) {
  const ctx=await browser.newContext({viewport:{width:320,height:568},reducedMotion:'reduce'});
  await ctx.addInitScript(seed=>{crypto.getRandomValues=a=>{a.fill(seed);return a;};},fixture.epicSeed);
  const page=await ctx.newPage();await page.goto(base+'/?skin=mist',{waitUntil:'networkidle'});await setSave(page,fixture.endings.get('commons'),fixture.archive);
  await button(page,'new').click();
  const ids=fixture.data.traits.filter(trait=>trait.rarity==='epic').map(trait=>trait.id);
  assert.equal(ids.length,3);
  for (const id of ids) await page.locator(`.trait-grid [data-id="${id}"]`).click();
  const issues=[];
  await fits(page,'320x568 three epic selections').catch(error=>issues.push(error.message));await button(page,'next-step').click();
  assert.equal(await page.locator('[data-action="rule"]').count(),8);
  await verifyAllocation(page,fixture.data,ids);await fits(page,'320x568 eight known rules and three epic descriptions').catch(error=>issues.push(error.message));
  await page.screenshot({path:path.join(out,'mist-320x568-worst-allocation.png')});
  assert.deepEqual(issues,[]);
  await ctx.close();console.log('320x568: three epic descriptions and eight learned rules fit together');
}

(async () => {
  const fixture = await fixtures();
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    if (!process.env.AI_LAYOUT_ONLY) for (const sample of [{width:1280,height:800},{width:390,height:664}]) await browserRoute(browser,fixture.data,sample);
    if (process.env.AI_LAYOUT_ONLY !== 'allocation') await layoutMatrix(browser,fixture);
    await worstAllocation(browser,fixture);
    const denied = await browser.newContext({viewport:{width:320,height:568}});await denied.addInitScript(() => Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}}));
    const page = await denied.newPage();await page.goto(base,{waitUntil:'networkidle'});await button(page,'save-info').click();await fits(page,'storage denied');assert.match(await page.locator('dialog').innerText(),/无法读取/);await denied.close();
    console.log('Storage denial passed');
    await legacyCompatibility(browser);
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
