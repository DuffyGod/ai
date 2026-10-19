// Measured browser evidence. The persona conclusions in the report are heuristic,
// not user-study findings and not a measurement of beauty.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const round = JSON.parse(fs.readFileSync('design/rounds.json')).find(row => row.id === process.argv[2]);
if (!round) throw Error('Provide a round id from design/rounds.json');
const base = process.env.AI_PREVIEW_URL || 'http://127.0.0.1:8030';
const out = `/workspace/ai-dev-tools/results/iterations/${round.id}`;
fs.mkdirSync(out, { recursive: true });
const samples = [{name:'desktop',width:1280,height:800},{name:'phone',width:390,height:664},{name:'short',width:320,height:568},{name:'landscape',width:667,height:375}];
const sourceHash = crypto.createHash('sha256').update(['docs/js/worldApp.js','docs/css/world.css','docs/css/skins.css'].filter(fs.existsSync).map(p=>fs.readFileSync(p)).join('\n')).digest('hex');
function measure() {
  const visible = el => el.checkVisibility() && getComputedStyle(el).visibility !== 'hidden';
  const rect = el => {const r=el.getBoundingClientRect();return {width:Math.round(r.width),height:Math.round(r.height)};};
  const problems=[];
  for(const el of document.querySelectorAll('.page,.trait-grid,.trait,.story-card,.reader-body,.dialog-shell,.dialog-content,.attribute-panel,.play-area,.trait-inspector,.record-detail,.record-list')){
    if(!visible(el))continue;
    if(el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2)problems.push(`${el.className}: ${el.scrollWidth}x${el.scrollHeight}/${el.clientWidth}x${el.clientHeight}`);
  }
  const buttons=[...document.querySelectorAll('button')].filter(visible);
  const outside=buttons.filter(el=>{const r=el.getBoundingClientRect();return r.top< -1||r.left< -1||r.bottom>innerHeight+1||r.right>innerWidth+1;}).map(el=>el.textContent.trim().slice(0,24));
  const traits=[...document.querySelectorAll('.trait-grid [data-action="trait"]')].filter(visible);
  const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const contrast=(a,b)=>{const x=lum(a),y=lum(b);return +((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2);};
  const contrasts=[...document.querySelectorAll('.trait-name,.trait-effect,.reader-text,.primary')].filter(visible).map(el=>{
    const fg=rgb(getComputedStyle(el).color);let p=el;
    while(p&&['rgba(0, 0, 0, 0)','transparent'].includes(getComputedStyle(p).backgroundColor))p=p.parentElement;
    return p?{element:el.className,ratio:contrast(fg,rgb(getComputedStyle(p).backgroundColor))}:null;
  }).filter(Boolean);
  return {visibleTraits:traits.length,traitSizes:traits.map(rect),traitPages:document.querySelectorAll('[data-action="trait-page"]').length,visibleChoices:document.querySelectorAll('[data-action="choose"]').length,choicePages:document.querySelectorAll('[data-action="choice-page"]').length,textPages:document.querySelectorAll('[data-action="text-page"]').length,overflow:problems,outside,documentScroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,minTargetHeight:Math.round(Math.min(...buttons.map(b=>b.getBoundingClientRect().height))),minMeasuredContrast:Math.min(...contrasts.map(x=>x.ratio)),contrasts};
}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[];
 try{
 for(const skin of round.skins)for(const sample of samples){
  const ctx=await browser.newContext({viewport:{width:sample.width,height:sample.height},reducedMotion:'reduce'});
  await ctx.addInitScript(()=>{crypto.getRandomValues=a=>{a.fill(1);return a;};});
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/?skin=${skin}`,{waitUntil:'networkidle'});
  await page.locator('[data-action="new"]').first().click();
  const setup=await page.evaluate(measure);
  await page.screenshot({path:path.join(out,`${skin}-${sample.name}-setup.png`)});
  const interaction = {};
  if(Number(round.id)>=9){
    const cards=page.locator('.trait-grid .trait'); await cards.first().focus();
    await page.keyboard.press('ArrowRight');
    interaction.arrowNavigation=await cards.nth(1).evaluate(el=>el===document.activeElement);
    await page.keyboard.press('Space');
    interaction.spaceSelects=(await page.locator('.trait-grid .trait[aria-pressed="true"]').count())===1;
    await page.keyboard.press('Space');
    interaction.spaceCancels=(await page.locator('.trait-grid .trait[aria-pressed="true"]').count())===0;
  }
  let navigationClicks=0;const desired=['echo','friendly','frugal'];
  for(const id of desired){
   for(let i=0;i<12;i++){
    const target=page.locator(`.trait-grid [data-action="trait"][data-id="${id}"]`);
    if(await target.count()){await target.click();break;}
    const next=page.locator('[data-action="trait-page"]').last();
    if(!(await next.count()))break;
    if(await next.isDisabled()){
     const previous=page.locator('[data-action="trait-page"]').first();
     while(!(await previous.isDisabled())){await previous.click();navigationClicks++;}
    }else{await next.click();navigationClicks++;}
   }
  }
  const selected=await page.locator('#selected-count').innerText();
  await page.screenshot({path:path.join(out,`${skin}-${sample.name}-selected.png`)});
  await page.locator('[data-action="next-step"]').click();const allocation=await page.evaluate(measure);
  await page.locator('[data-action="start"]').click();const play=await page.evaluate(measure);
  await page.screenshot({path:path.join(out,`${skin}-${sample.name}-play.png`)});
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('ai_worlds_v1')));
  save.run.turn=36;save.run.stage='open';save.run.flags=['distributed'];save.run.pending='world';
  await page.evaluate(s=>localStorage.setItem('ai_worlds_v1',JSON.stringify(s)),save);
  await page.reload({waitUntil:'networkidle'});await page.locator('[data-action="resume"]').click();
  const decision=await page.evaluate(measure);
  await page.screenshot({path:path.join(out,`${skin}-${sample.name}-decision.png`)});
  const auxiliary = {};
  if(Number(round.id)>=8){
   await page.locator('[data-action="notebook"]').first().click();
   auxiliary.notebookIndex=await page.evaluate(measure);
   auxiliary.indexedRecords=await page.locator('dialog [data-action="record"]').count();
   await page.locator('dialog [data-action="record"]').first().click();
   auxiliary.notebookDetail=await page.evaluate(measure);
   await page.keyboard.press('Escape');
   await page.locator('[data-action="history"]').click();
   auxiliary.history=await page.evaluate(measure);
   await page.keyboard.press('Escape');
  }
  if(Number(round.id)>=9){
    await page.locator('[data-action="appearance"]').click();
    const alternate=skin==='mist'?'paper':'mist';
    await page.locator(`[data-action="skin"][data-id="${alternate}"]`).click();
    await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});
    interaction.preferenceSurvivesReload=await page.evaluate(id=>document.documentElement.dataset.skin===id&&localStorage.getItem('ai_skin')===id,alternate);
  }
  results.push({skin,sample,setup,selection:{selected,navigationClicks},allocation,play,decision,auxiliary,interaction,errors});
  await ctx.close();
 }
 }finally{await browser.close();}
 const report={...round,sourceHash,measuredAt:new Date().toISOString(),results};
 fs.writeFileSync(`design/iterations/${round.id}.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({round:round.id,hash:sourceHash.slice(0,12),samples:results.length,visibleTraits:[...new Set(results.map(x=>x.setup.visibleTraits))],comparisonPageClicks:[...new Set(results.map(x=>x.selection.navigationClicks))],overflowCases:results.filter(x=>[x.setup,x.allocation,x.play,x.decision,...Object.values(x.auxiliary||{}).filter(m=>m && typeof m==='object')].some(m=>m.overflow.length||m.outside.length||m.documentScroll)).map(x=>x.skin+'/'+x.sample.name),minContrast:Math.min(...results.flatMap(x=>[x.setup,x.play,x.decision].map(m=>m.minMeasuredContrast))),errors:results.flatMap(x=>x.errors)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
