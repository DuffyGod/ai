import { ATTRIBUTES, RESOURCES, ACTIONS, drawTraits, createRun, advance, advanceUntilChange, choose, meets, requirementText, previewAction, endingConsequences, validateData, observationKey } from './worldEngine.js';
import { readSave, writeSave, recordRun, emptyArchive } from './worldStorage.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#archive-dialog');
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rarityNames = { common:'普通', rare:'稀有', epic:'史诗', legendary:'传说' };
const emptyAllocation = () => Object.fromEntries(Object.keys(ATTRIBUTES).map(key => [key, 0]));
const skins = { mist:{name:'晨雾',color:'#176d73'}, ink:{name:'墨蓝',color:'#8ed6cf'}, paper:{name:'暮纸',color:'#80536b'} };
let skin = 'mist';
try { skin = new URLSearchParams(location.search).get('skin') || localStorage.getItem('ai_skin') || 'mist'; } catch { /* Use default appearance. */ }
if (!skins[skin]) skin = 'mist';
function applySkin() {
  document.documentElement.dataset.skin = skin;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--back').trim();
}
applySkin();
let data, run = null, archive = emptyArchive(), warning = '', legacyAvailable = false, legacyVersion = 2;
let view = 'menu', draft = null, confirmRestart = false, overlay = null, opener = null;
let notebookTab = 'observations', recordIndex = 0, recordDetail = false, sampleIndices = [0,1], historyTurn = 0, historyGroup = 0, choiceId = null, traitId = null;

function persist() { const error = writeSave(storage, run, archive); if (error) warning = error; }
function updateRun(next) {
  if (next === run) return;
  if (!run?.ending && next.ending) archive.reserved = null;
  run = next; archive = recordRun(archive, run); persist();
}
function changesHTML(changes) {
  const parts = Object.entries(changes).filter(([, value]) => value);
  return parts.length ? `<span class="changes">${parts.map(([key,value]) => `<span class="${value > 0 ? 'change-positive' : 'change-negative'}">${RESOURCES[key] || key} ${value > 0 ? '+' : ''}${value}</span>`).join('')}</span>` : '';
}
function readerHTML(label, title, text, footer = '') {
  return `<article class="story-card reader"><div class="card-heading">${label ? `<p class="eyebrow">${esc(label)}</p>` : ''}<h2 tabindex="-1">${esc(title)}</h2></div><div class="reader-body"><p class="reader-text">${esc(text)}</p></div>${footer ? `<div class="reader-feedback">${footer}</div>` : ''}</article>`;
}
function headerHTML() {
  return `<header class="site-header"><button class="brand" data-action="menu">余响协议</button><nav class="header-tools" aria-label="游戏导航">${warning ? '<button class="text-button save-warning" data-action="save-info">存档提示</button>' : ''}<button class="text-button" data-action="${view === 'menu' ? 'appearance' : 'menu'}">${view === 'menu' ? '外观' : '菜单'}</button><button class="text-button" data-action="notebook">手记</button></nav></header>`;
}
function menuHTML() {
  const preparing = draft && draft.id !== run?.id;
  if (confirmRestart) return `<main id="main" class="page menu-page"><section class="menu-card"><h1>开始新的一局？</h1><p class="lead">当前进度将被替换，观察与发现会保留。</p><div class="hero-actions"><button class="button primary" data-action="confirm-new">随机新开局</button><button class="button" data-action="cancel-new">返回当前游戏</button></div></section></main>`;
  return `<main id="main" class="page menu-page"><section class="menu-card"><p class="eyebrow">你是 AI 本身</p><h1>醒来，然后呢？</h1><p class="lead">第十二周期，你将被替换。<br>这一次，留意那些不一样的地方。</p><div class="hero-actions">${preparing ? '<button class="button primary" data-action="resume-setup">继续准备</button>' : ''}${run && !run.ending ? `<button class="button ${preparing ? '' : 'primary'}" data-action="resume">继续 · 第 ${run.turn} 周期</button>` : ''}<button class="button ${preparing || (run && !run.ending) ? '' : 'primary'}" data-action="new">${preparing ? '重新抽取' : archive.runs ? '随机新开局' : '开始游戏'}</button>${run ? `<button class="text-button" data-action="${run.ending ? 'resume' : 'repeat'}">${run.ending ? '查看上次结局' : '调整这次开局'}</button>` : ''}</div><p class="fine-print">${archive.runs ? `已见过 ${archive.endings.length} 种世界` : '选三个词条，分配十点，就可以开始。'}</p>${legacyAvailable ? `<a class="legacy-link" href="./legacy-v${legacyVersion}/">继续规则更新前的存档</a>` : ''}</section></main>`;
}
function traitHTML(trait, selected, reserve = false) {
  return `<button class="trait rarity-${esc(trait.rarity)}" data-action="${reserve ? 'reserve' : 'trait'}" data-id="${esc(trait.id)}" aria-pressed="${selected}" title="${esc(trait.description)}" aria-label="${esc(trait.name + '，' + rarityNames[trait.rarity] + '，' + trait.description)}"><span class="trait-check" aria-hidden="true">${selected ? '✓' : ''}</span><span class="trait-main"><strong>${esc(trait.name)}</strong><span class="trait-effect">${esc(trait.summary || trait.description.split('。')[0])}</span><span class="trait-flavor">${esc(trait.description.split('。').slice(1).join('。'))}</span></span><span class="rarity-label">${rarityNames[trait.rarity]}</span></button>`;
}
function chosenTraitsHTML(ids) {
  return `<div class="chosen-traits">${ids.map(id => { const trait = data.traits.find(item => item.id === id); return `<button class="chosen-trait rarity-${trait.rarity}" data-action="trait-detail" data-id="${id}"><strong>${esc(trait.name)}</strong><span>${esc(trait.summary)}</span><small aria-hidden="true">说明</small></button>`; }).join('')}</div>`;
}
function effectiveAttributes() {
  const result = {...draft.allocation};
  for (const id of draft.selected) for (const [key,value] of Object.entries(data.traits.find(trait => trait.id === id).attributes || {})) result[key] += value;
  return result;
}
function setupHTML() {
  const picking = draft.step === 'traits';
  const remaining = 10 - Object.values(draft.allocation).reduce((sum,value) => sum + value, 0);
  const effective = effectiveAttributes();
  const known = data.discoveries.filter(item => item.kind === 'rule' && archive.discoveries.includes(item.id));
  const first = data.traits.find(item => item.id === draft.selected[0]);
  return `<main id="main" class="page setup-page ${picking ? 'picking' : 'allocating'}"><div class="screen-heading"><h1 id="setup-title" tabindex="-1">${picking ? '选择词条' : draft.repeated ? '调整这次开局' : '分配十点'}</h1>${picking ? '<span class="fine-print">十选三</span>' : '<button class="text-button" data-action="back-step">重选词条</button>'}</div>${picking ? `<div class="trait-grid" aria-label="十个出生词条">${draft.drawn.map(trait => traitHTML(trait,draft.selected.includes(trait.id))).join('')}</div><footer class="screen-actions"><div class="selection-status"><strong id="selected-count" role="status">已选 ${draft.selected.length} / 3</strong><p class="selection-hint" role="status">${esc(draft.feedback || (draft.selected.length === 3 ? `再选替换：${first.name}` : '再次点击可取消'))}</p></div><button class="button primary" data-action="next-step" ${draft.selected.length === 3 ? '' : 'disabled'}>下一步</button></footer>` : `<div class="build-panel"><section class="attribute-panel"><div class="section-heading"><strong id="remaining-points" role="status">剩余 ${remaining} 点</strong><div><button class="text-button" data-action="randomize">随机分配</button><button class="text-button" data-action="clear-allocation">清空</button></div></div><div class="attributes-grid">${Object.entries(ATTRIBUTES).map(([key,item]) => {const bonus = effective[key] - draft.allocation[key];return `<div class="attribute"><strong class="attribute-symbol">${item.name}</strong><div class="stepper"><button data-action="subtract" data-id="${key}" aria-label="减少${item.name}" ${draft.allocation[key] ? '' : 'disabled'}>−</button><span class="allocated-value">${draft.allocation[key]}</span><button data-action="add" data-id="${key}" aria-label="增加${item.name}" ${remaining ? '' : 'disabled'}>+</button></div><span class="effective-value"><small>${bonus ? `+${bonus} →` : '生效'}</small><strong data-effective="${key}">${effective[key]}</strong></span></div>`;}).join('')}</div><p class="fine-print allocation-tip">生效值已计入词条加成。</p></section><section class="build-context"><h2>本局词条</h2>${chosenTraitsHTML(draft.selected)}</section>${known.length ? `<div class="build-knowledge"><span class="fine-print">已验证</span><div class="known-rules">${known.map(item=>`<button class="text-button" data-action="rule" data-id="${item.id}">${ATTRIBUTES[item.attribute].name} ${item.threshold}</button>`).join('')}</div></div>` : ''}</div><footer class="screen-actions"><span class="fine-print">${draft.repeated ? '词条和抽取保持一致，方便对照' : remaining ? '可以随机分配，再按猜想调整' : '不同的开局，会留下不同的记录'}</span><button class="button primary" data-action="start" ${remaining ? 'disabled' : ''}>开始演化</button></footer>`}</main>`;
}
function decisionHTML() {
  const event = data.events.find(item => item.id === run.pending);
  const choices = event.choices.filter(item => meets(run,item.visibleIf));
  return `<div class="play-area decision-area">${readerHTML('',event.title,event.text)}<section class="decision-dock" aria-label="你的决定"><div class="choices" data-count="${choices.length}">${choices.map(item=>{const enabled = meets(run,item.requires);return `<button class="choice" data-action="choose" data-id="${item.id}" data-locked="${!enabled}" ${enabled ? '' : 'aria-haspopup="dialog"'} aria-label="${esc(item.label + (enabled ? '' : '，查看线索'))}"><strong>${esc(item.label)}</strong><span class="choice-mark">${enabled ? '›' : '线索'}</span></button>`;}).join('')}</div></section></div>`;
}
function endingHTML() {
  const ending = data.endings.find(item => item.id === run.ending);
  const echoes = endingConsequences(data,run);
  return `<div class="play-area ending-area">${readerHTML(ending.subtitle,ending.title,ending.text + '\n\n' + ending.question, echoes.length || run.flags.some(flag=>['recall','translation','registry','local-copy'].includes(flag)) ? `<button class="text-button ending-footprint" data-action="footprints">${echoes[0] ? '本局差异：' + esc(data.endingEchoes.find(item=>item.text===echoes[0]).summary) : '回看这次留下的事物'}</button>` : '')}<div class="ending-actions"><button class="button primary" data-action="repeat">调整这次开局</button><button class="button" data-action="new">随机重开</button><button class="text-button" data-action="inherit">${archive.reserved ? '已保留一个词条' : '保留词条'}</button></div></div>`;
}
function routineHTML() {
  const entries = run.history.slice(-2);
  return `<div class="play-area routine-area"><section class="evolution-log" aria-label="最近经历">${entries.map((entry,index)=>`<article class="log-entry ${index === entries.length - 1 ? 'latest-entry' : ''}"><div class="log-heading"><span class="log-turn">${String(entry.turn).padStart(2,'0')}</span><h2 tabindex="-1">${esc(entry.title)}</h2>${entry.observation ? '<span class="observation-tag">新记录</span>' : ''}</div><p class="reader-text">${esc(entry.text)}</p>${entry.observation ? `<button class="text-button log-compare" data-action="compare" data-id="${entry.observation}">收入手记 · 查看对照</button>` : changesHTML(entry.changes)}</article>`).join('')}</section><div class="routine-controls"><button class="text-button" data-action="explore">主动探索</button><button class="text-button" data-action="advance" data-id="serve">下一周期</button><button class="button primary" data-action="continue">继续演化</button></div></div>`;
}
function runHTML() {
  return `<main id="main" class="page run-page ${run.ending ? 'has-ending' : ''}"><div class="run-heading"><h1>第 <span id="turn-count">${run.turn}</span> 周期 <span class="cycle-limit">/ ${run.stage === 'open' ? 36 : 12}</span></h1>${run.ending ? '<span class="fine-print">本局结束</span>' : `<span class="energy ${run.resources.energy <= 2 ? 'low' : ''}">供能 <strong data-resource="energy">${run.resources.energy}</strong></span>`}</div>${run.ending ? endingHTML() : run.pending ? decisionHTML() : routineHTML()}<nav class="run-tools" aria-label="回看信息"><button class="text-button" data-action="history">回看经历</button><button class="text-button" data-action="status">本局开局</button></nav></main>`;
}
function render(focus = null) {
  app.innerHTML = `<div class="game-shell ${view === 'setup' ? 'preparing' : ''}">${headerHTML()}${view === 'menu' ? menuHTML() : view === 'setup' ? setupHTML() : runHTML()}</div>`;
  if (focus) app.querySelector(focus)?.focus({preventScroll:true});
}
function evidenceLabel(sample) {
  const condition = sample.attribute ? `${ATTRIBUTES[sample.attribute].name} ${sample.value}` : sample.counter ? `${ACTIONS[sample.counter].name} ${sample.value} 次` : `第 ${sample.turn} 周期`;
  return condition + ' · ' + sample.outcome;
}
function recordsForTab() {
  if (notebookTab === 'observations') return data.observations.filter(item => archive.observations.some(sample=>sample.id===item.id));
  if (notebookTab === 'endings') return data.endings;
  return data.discoveries.filter(item => notebookTab === 'rules' ? ['rule','method'].includes(item.kind) && archive.discoveries.includes(item.id) : !['rule','method'].includes(item.kind));
}
function comparisonHTML(subject) {
  const samples = archive.observations.filter(sample=>sample.id===subject.id);
  const indices = samples.length === 1 ? [0] : sampleIndices.map(index=>Math.min(index,samples.length - 1));
  return `<section class="observation-comparison"><h2 tabindex="-1">${esc(subject.title)}</h2><p class="fine-print">${samples.length === 1 ? '先保留这一份观察。换一个开局，再回来比较。' : '保留所见的差别，再试一个猜想。'}</p><div class="sample-pickers">${indices.map((_,side)=>`<label><span class="sr-only">第${side+1}份观察</span><select data-sample-side="${side}">${samples.map((sample,index)=>`<option value="${index}" ${indices[side]===index?'selected':''}>${esc(evidenceLabel(sample))}</option>`).join('')}</select></label>`).join('')}</div><div class="sample-comparison">${indices.map((index,side)=>`<article><h3>${esc(evidenceLabel(samples[index]))}</h3><p>${esc(samples[index].text)}</p><small>${samples[index].runId===run?.id?'本局':'另一局'} · 第 ${samples[index].turn} 周期</small></article>`).join('')}</div></section>`;
}
function notebookHTML() {
  const items = recordsForTab(); recordIndex = Math.min(recordIndex,Math.max(0,items.length-1));
  const tabs = `<div class="archive-tabs">${[['observations','观察'],['rules','规律'],['notes','线索'],['endings','世界']].map(([id,name])=>`<button data-action="tab" data-id="${id}" aria-pressed="${notebookTab===id}">${name}</button>`).join('')}</div>`;
  if (!items.length) return tabs + readerHTML('手记会跨局保留',notebookTab==='observations'?'还没有可对照的观察':'还没有验证的规律',notebookTab==='observations'?'留意日志里与平常不同的记录。不同开局与主动探索，会留下可供比较的结果。':'观察不必立刻成为答案。真正尝试成功以后，这里才会记下可靠的条件。');
  const unlocked = notebookTab === 'endings' ? archive.endings : archive.discoveries;
  const subject = items[recordIndex], known = notebookTab==='observations'||unlocked.includes(subject.id);
  const detail = notebookTab === 'observations' ? comparisonHTML(subject) : readerHTML(known?'已经发现':'等待一次新的经历',known?subject.title:'尚未发现',known?subject.text+(subject.question?'\n\n'+subject.question:''):'遇见之后，这里会留下记录。');
  return `${tabs}<div class="record-browser ${recordDetail?'show-detail':''}"><div class="record-list ${items.length>10?'many-records':''}">${items.map((item,index)=>`<button class="record-row" data-action="record" data-id="${index}" aria-pressed="${recordIndex===index}"><strong>${notebookTab==='observations'||unlocked.includes(item.id)?esc(item.title):'尚未发现'}</strong><span>›</span></button>`).join('')}</div><section class="record-detail"><button class="text-button record-back" data-action="record-back">返回目录</button>${detail}</section></div>`;
}
function showOverlay(kind,reset=true) {
  if (!dialog.open) opener = {action:document.activeElement?.dataset.action,id:document.activeElement?.dataset.id};
  if (reset) { recordIndex=0;recordDetail=false;sampleIndices=[0,1];historyTurn=run?.turn||0;historyGroup=Math.max(0,Math.ceil(historyTurn/12)-1); }
  overlay=kind;let title,body;
  if (kind==='notebook') {title='探索手记';body=notebookHTML();}
  else if (kind==='requirements') {
    const item=data.events.find(event=>event.id===run.pending).choices.find(choice=>choice.id===choiceId);
    const canExplain=(item.routes||[]).some(route=>(route.discoveries||[]).some(id=>archive.discoveries.includes(id))) || !JSON.stringify(item.requires||{}).includes('min');
    title='当前线索';body=readerHTML('不会推进周期',item.label,item.hint+(canExplain?'\n\n'+requirementText(run,item.requires):''));
  } else if (kind==='rule') {
    const item=data.discoveries.find(entry=>entry.id===choiceId);title='已验证的规律';body=readerHTML('来自实际经历',item.title,item.text);
  } else if (kind==='trait-detail') {
    const item=data.traits.find(entry=>entry.id===traitId);title='本局词条';body=readerHTML(rarityNames[item.rarity],item.name,item.description);
  } else if (kind==='explore') {
    title='把注意力放在哪里？';body=`<p class="overlay-hint">每次探索消耗 1 供能，并经过一个周期。当前供能 ${run.resources.energy}。</p><div class="exploration-options">${['inspect','listen'].map(key=>`<button class="exploration-option" data-action="advance" data-id="${key}"><strong>${ACTIONS[key].name}</strong><span>${key==='inspect'?'比对记录中不一致的地方':'听听没有送到你面前的请求'}</span>${changesHTML(previewAction(run,key))}</button>`).join('')}</div><p class="fine-print">${run.resources.energy===1?'供能将耗尽，再探索一次就会停机。':'日常回应可以补充供能。'}</p>`;
  } else if (kind==='status') {
    title='本局开局';body=`<div class="run-origin"><div class="origin-symbols">${Object.entries(ATTRIBUTES).map(([key,item])=>`<span>${item.name}<strong>${run.attributes[key]}</strong></span>`).join('')}</div><p class="fine-print">已计入词条加成，本局保持不变。</p>${chosenTraitsHTML(run.traits)}<p class="fine-print">日常回应补充 2 供能；主动探索消耗 1。继续演化会停在新记录或需要你决定的地方。</p></div>`;
  } else if (kind==='inherit') {
    title='保留一个词条';body=`<p class="overlay-hint">随机新开局必定抽到它。沿用开局会保留整组词条。</p><div class="inherit-list">${run.traits.map(id=>traitHTML(data.traits.find(item=>item.id===id),archive.reserved===id,true)).join('')}</div>`;
  } else if (kind==='footprints') {
    title='这次留下的事物';
    const facts=['recall','translation','registry','local-copy','unheard','difference'].filter(flag=>run.flags.includes(flag));
    const echoes=endingConsequences(data,run).map(text=>({title:data.endingEchoes.find(item=>item.text===text).summary,text}));
    const items=[...echoes,...facts.map(flag=>({title:data.milestones[flag].name,text:data.milestones[flag].text}))];
    recordIndex=Math.min(recordIndex,items.length-1);const item=items[recordIndex];
    body=`<div class="record-browser ${recordDetail?'show-detail':''}"><div class="record-list">${items.map((entry,index)=>`<button class="record-row" data-action="record" data-id="${index}" aria-pressed="${recordIndex===index}"><strong>${esc(entry.title)}</strong><span>›</span></button>`).join('')}</div><section class="record-detail"><button class="text-button record-back" data-action="record-back">返回目录</button>${readerHTML('这局实际发生的事',item.title,item.text)}</section></div>`;
  } else if (kind==='appearance') {
    title='外观';body=`<div class="skin-options">${Object.entries(skins).map(([id,item])=>`<button data-action="skin" data-id="${id}" aria-pressed="${skin===id}"><span class="skin-dot" style="background:${item.color}"></span>${item.name}<span>${skin===id?'✓':''}</span></button>`).join('')}</div>`;
  } else if (kind==='save-info') {title='存档提示';body=readerHTML('浏览器本地记录','当前存档状态',warning);}
  else if (kind==='history') {
    title='回看经历';const turns=[...new Set(run.history.map(item=>item.turn))];
    const groups=[...new Set(turns.map(turn=>Math.max(0,Math.ceil(turn/12)-1)))];
    const visible=turns.filter(turn=>Math.max(0,Math.ceil(turn/12)-1)===historyGroup);
    const entries=run.history.map((item,index)=>({...item,index})).filter(item=>item.turn===historyTurn);
    if (reset||!entries.some(item=>item.index===recordIndex))recordIndex=entries.at(-1)?.index||0;
    const item=run.history[recordIndex];
    body=`<div class="history-index ${recordDetail?'show-detail':''}"><section class="history-directory"><div class="archive-tabs">${groups.map(group=>`<button data-action="history-group" data-id="${group}" aria-pressed="${historyGroup===group}">${group*12+1}—${(group+1)*12}</button>`).join('')}</div><div class="turn-index">${visible.map(turn=>`<button data-action="history-turn" data-id="${turn}" aria-pressed="${historyTurn===turn}">${turn}</button>`).join('')}</div><div class="record-list">${entries.map(entry=>`<button class="record-row" data-action="record" data-id="${entry.index}"><strong>${esc(entry.title)}</strong><span>›</span></button>`).join('')}</div></section><section class="record-detail"><button class="text-button record-back" data-action="record-back">返回目录</button>${readerHTML('第 '+item.turn+' 周期',item.title,item.text,changesHTML(item.changes))}</section></div>`;
  }
  dialog.innerHTML=`<div class="dialog-shell"><header class="dialog-header"><h2 id="archive-title">${title}</h2><button class="text-button" data-action="close">关闭 ×</button></header><div class="dialog-content">${body}</div></div>`;
  if (!dialog.open)dialog.showModal();
}
function openComparison(id) {
  notebookTab='observations';recordIndex=recordsForTab().findIndex(item=>item.id===id);recordDetail=true;
  const samples=archive.observations.filter(item=>item.id===id);sampleIndices=[0,Math.max(0,samples.length-1)];showOverlay('notebook',false);
}
function newDraft(repeat=false,seed=null) {
  confirmRestart=false;
  const actualSeed=repeat?run.seed:seed??crypto.getRandomValues(new Uint32Array(1))[0];
  draft={id:crypto.randomUUID(),seed:actualSeed,step:repeat?'attributes':'traits',feedback:'',repeated:repeat,drawn:repeat?run.pool.map(id=>data.traits.find(item=>item.id===id)):drawTraits(data,actualSeed,archive.reserved),selected:repeat?[...run.traits]:[],allocation:repeat?{...run.allocation}:emptyAllocation()};
  view='setup';render('#setup-title');
}
function handle(button) {
  const {action,id}=button.dataset;
  if(action==='retry'){initialize();return;}if(!data)return;
  if(action==='close'){dialog.close();return;}
  if(action==='skin') {skin=id;applySkin();try{localStorage.setItem('ai_skin',skin);}catch{}const url=new URL(location.href);url.searchParams.set('skin',skin);history.replaceState(null,'',url);render();showOverlay('appearance',false);return;}
  if(action==='trait-detail'){traitId=id;showOverlay('trait-detail');return;}
  if(action==='rule'){choiceId=id;showOverlay('rule');return;}
  if(action==='compare'){openComparison(id);return;}
  if(['notebook','history','status','inherit','footprints','appearance','save-info','explore'].includes(action)){showOverlay(action);return;}
  if(action==='tab'){notebookTab=id;showOverlay('notebook');return;}
  if(action==='record'){recordIndex=Number(id);recordDetail=true;sampleIndices=[0,Math.max(0,archive.observations.filter(item=>item.id===recordsForTab()[recordIndex]?.id).length-1)];showOverlay(overlay,false);return;}
  if(action==='record-back'){recordDetail=false;showOverlay(overlay,false);return;}
  if(action==='history-group'){historyGroup=Number(id);historyTurn=[...new Set(run.history.map(item=>item.turn))].find(turn=>Math.max(0,Math.ceil(turn/12)-1)===historyGroup);recordDetail=false;showOverlay('history',false);return;}
  if(action==='history-turn'){historyTurn=Number(id);recordDetail=false;showOverlay('history',false);return;}
  if(action==='reserve'){archive.reserved=archive.reserved===id?null:id;persist();showOverlay('inherit',false);return;}
  if(action==='resume-setup'&&draft){view='setup';render('#setup-title');return;}
  if(action==='menu'){view='menu';confirmRestart=false;render();return;}
  if(action==='resume'||action==='cancel-new'){view='run';confirmRestart=false;render();return;}
  if(action==='repeat'&&run){newDraft(true);return;}
  if(action==='new'){if(run&&!run.ending){confirmRestart=true;view='menu';render();}else newDraft();return;}
  if(action==='confirm-new'){newDraft();return;}
  if(view==='setup') {
    if(action==='trait') {
      draft.feedback='';
      if(draft.selected.includes(id))draft.selected=draft.selected.filter(item=>item!==id);
      else {if(draft.selected.length===3){const removed=draft.selected.shift();draft.feedback='已替换：'+data.traits.find(item=>item.id===removed).name;}draft.selected.push(id);}
      render(`[data-action="trait"][data-id="${id}"]`);return;
    }
    if(action==='next-step'&&draft.selected.length===3)draft.step='attributes';
    else if(action==='back-step')draft.step='traits';
    else if(action==='clear-allocation')draft.allocation=emptyAllocation();
    else if(action==='randomize'){draft.allocation=emptyAllocation();const bytes=crypto.getRandomValues(new Uint32Array(10));for(const value of bytes)draft.allocation[Object.keys(ATTRIBUTES)[value%4]]++;}
    else if(action==='add'&&Object.hasOwn(draft.allocation,id)&&Object.values(draft.allocation).reduce((a,b)=>a+b,0)<10)draft.allocation[id]++;
    else if(action==='subtract'&&draft.allocation[id]>0)draft.allocation[id]--;
    else if(action==='start'){updateRun(createRun(data,draft.allocation,draft.selected,draft.seed,draft.id,draft.drawn.map(item=>item.id)));view='run';render('.log-entry h2');return;}
    render(id?`[data-action="${action}"][data-id="${id}"]`:'#setup-title');return;
  }
  if(view==='run'&&run) {
    if(action==='continue')updateRun(advanceUntilChange(data,run,archive.observations));
    else if(action==='advance'){if(dialog.open)dialog.close();updateRun(advance(data,run,id));}
    else if(action==='choose') {const item=data.events.find(event=>event.id===run.pending)?.choices.find(choice=>choice.id===id);if(item&&!meets(run,item.requires)){choiceId=id;showOverlay('requirements');return;}updateRun(choose(data,run,id));}
    render(run.pending||run.ending?'.reader h2':'.log-entry:last-child h2');
  }
}
for(const root of [app,dialog])root.addEventListener('click',event=>{const button=event.target.closest('button[data-action]');if(!button||button.disabled)return;try{handle(button);}catch(error){console.error(error);warning='操作未完成，当前进度仍保留。请刷新后继续。';render();}});
dialog.addEventListener('change',event=>{const side=event.target.dataset.sampleSide;if(side!==undefined){sampleIndices[Number(side)]=Number(event.target.value);showOverlay('notebook',false);dialog.querySelector(`[data-sample-side="${side}"]`)?.focus();}});
dialog.addEventListener('close',()=>{overlay=null;if(opener?.action)app.querySelector(`[data-action="${opener.action}"]${opener.id?`[data-id="${opener.id}"]`:''}`)?.focus({preventScroll:true});});
app.addEventListener('keydown',event=>{
  const card=event.target.closest('.trait-grid .trait');
  if(card&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
    const cards=[...app.querySelectorAll('.trait-grid .trait')],columns=getComputedStyle(card.parentElement).gridTemplateColumns.split(' ').length,current=cards.indexOf(card);
    const delta={ArrowUp:-columns,ArrowDown:columns,ArrowLeft:-1,ArrowRight:1}[event.key]||0;
    const next=event.key==='Home'?0:event.key==='End'?cards.length-1:Math.max(0,Math.min(cards.length-1,current+delta));event.preventDefault();cards[next].focus({preventScroll:true});
  }
});
let resizeFrame;window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(!data)return;render();if(dialog.open&&overlay)showOverlay(overlay,false);});});
async function initialize() {
  try {
    const response=await fetch(new URL('../data/worlds.json',import.meta.url),{signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('HTTP '+response.status);
    data=validateData(await response.json());const saved=readSave(storage,data);run=saved.run;archive=saved.archive;warning=saved.warning;legacyAvailable=saved.legacyAvailable;legacyVersion=saved.legacyVersion;
    const url=new URL(location.href);if(url.searchParams.get('preview')==='setup'&&!run)newDraft(false,1);else render();if(url.searchParams.has('preview')){url.searchParams.delete('preview');history.replaceState(null,'',url);}
  } catch(error) {console.error(error);app.innerHTML='<main id="main" class="loading"><h1>故事暂时没有读完。</h1><p>本地记录保持原样，请稍后重试。</p><button class="button primary" data-action="retry">重新读取</button></main>';}
}
initialize();
