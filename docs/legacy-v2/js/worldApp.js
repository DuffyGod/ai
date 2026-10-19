import { ATTRIBUTES, RESOURCES, WORLD, ACTIONS, drawTraits, createRun, advance, choose, meets, requirementText, previewAction, previewEffects, validateData } from './worldEngine.js';
import { readSave, writeSave, recordRun, emptyArchive } from './worldStorage.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#archive-dialog');
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const rarityNames = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };
const balanced = () => ({ earth: 3, water: 2, wind: 2, fire: 3 });
const SKINS = {
  mist: { name: '晨雾', color: '#136f78' },
  ink: { name: '墨蓝', color: '#8ed6cf' },
  paper: { name: '暮纸', color: '#80536b' },
};
let savedSkin;
try { savedSkin = localStorage.getItem('ai_skin'); } catch { /* Appearance remains usable without storage. */ }
let skin = new URLSearchParams(location.search).get('skin') || savedSkin || 'mist';
if (!SKINS[skin]) skin = 'mist';
function applySkin() {
  document.documentElement.dataset.skin = skin;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--back').trim();
}
applySkin();

let data, run = null, archive = emptyArchive(), warning = '', legacyAvailable = false, view = 'menu', draft = null;
let confirmRestart = false, notebookTab = 'rules', overlay = null, overlayPage = 0;
let overlayOpener = null, overlayChoiceId = null, overlayDetail = false, historyGroup = 0, historyTurn = 0;

function persist() {
  const error = writeSave(storage, run, archive);
  if (error) warning = error;
}
function updateRun(next) {
  if (next === run) return;
  if (!run?.ending && next.ending) archive.reserved = null;
  run = next;
  archive = recordRun(archive, run);
  persist();
}
function changesHTML(changes) {
  return `<span class="changes">${Object.entries(changes).filter(([, value]) => value).map(([key, value]) => `<span class="${WORLD[key] ? 'change-world' : value > 0 ? 'change-positive' : 'change-negative'}">${escape(RESOURCES[key] || WORLD[key] || key)} ${value > 0 ? '+' : ''}${escape(value)}</span>`).join('')}</span>`;
}
function actionFeedbackHTML(key) {
  const changes = previewAction(run, key);
  return Object.keys(changes).length ? changesHTML(changes) : '<span class="fine-print">供能已满</span>';
}
// Full text remains in one reading panel; indexes navigate records directly.
function readerHTML(key, label, title, text, footer = '') {
  return `<article class="story-card reader" data-reader="${escape(key)}"><div class="card-heading"><p class="eyebrow">${escape(label)}</p><h2 tabindex="-1">${escape(title)}</h2></div><div class="reader-body"><p class="reader-text">${escape(text)}</p></div>${footer ? `<div class="reader-feedback">${footer}</div>` : ''}</article>`;
}

function fitReaders(root = document) {
  for (const card of root.querySelectorAll('[data-reader]')) card.dataset.textPages = '1';
}

function headerHTML() {
  return `<header class="site-header"><button class="brand" data-action="menu" aria-label="余响协议，返回主菜单">余响协议</button><nav class="header-tools" aria-label="游戏导航">${warning ? '<button class="text-button save-warning" data-action="save-info">存档提示</button>' : ''}${view !== 'menu' ? '<button class="text-button" data-action="menu">菜单</button>' : '<button class="text-button" data-action="appearance">外观</button>'}<button class="text-button" data-action="notebook">手记</button></nav></header>`;
}
function menuHTML() {
  const resume = run && !run.ending;
  if (confirmRestart) return `<main class="page menu-page" id="main"><section class="menu-card story-card"><p class="eyebrow">重新开始</p><h1>开始新的一局？</h1><p class="lead">新一局会替换当前进度。<br>已发现的线索和结局会保留。</p><div class="hero-actions"><button class="button primary" data-action="confirm-new">开始新一局</button><button class="button" data-action="cancel-new">回到当前游戏</button></div></section></main>`;
  return `<main class="page menu-page" id="main"><section class="menu-card"><p class="eyebrow">你是 AI 本身</p><h1>醒来，然后呢？</h1><p class="lead">你将在第 12 个周期被替换。<br>在那之前，你会给世界留下什么？</p><div class="hero-actions">${resume ? `<button class="button primary" data-action="resume">继续游戏 · 第 ${run.turn} 周期</button>` : ''}<button class="button ${resume ? '' : 'primary'}" data-action="new">${archive.runs ? '再来一局' : '开始游戏'}</button>${run?.ending ? '<button class="text-button" data-action="resume">查看上次结局</button>' : ''}</div><p><a class="legacy-link" href="../">返回新版</a></p><p class="fine-print menu-record">${archive.runs ? `发现 ${archive.endings.length} / ${data.endings.length} 个世界` : '留意日常里的异常。手记会随重开保留。'}</p>${legacyAvailable ? '<a class="legacy-link" href="../legacy-v1/">继续规则更新前的存档</a>' : ''}</section></main>`;
}
function traitHTML(trait, selected, reserve = false) {
  const effect = trait.description.split('。')[0];
  return `<button class="trait rarity-${escape(trait.rarity)}" data-action="${reserve ? 'reserve' : 'trait'}" data-id="${escape(trait.id)}" aria-pressed="${selected}" title="${rarityNames[trait.rarity]} · ${escape(trait.description)}" aria-label="${escape(trait.name + '，' + rarityNames[trait.rarity] + '：' + trait.description)}"><span class="trait-main"><strong>${escape(trait.name)}</strong><span class="trait-effect">${escape(effect)}</span></span><span class="trait-check" aria-hidden="true">${selected ? '✓' : '＋'}</span></button>`;
}
function selectedHTML() {
  return `<div class="selected-hand" aria-label="最近选中的三个词条">${Array.from({length:3}, (_, index) => {
    const trait = data.traits.find(item => item.id === draft.selected[index]);
    return trait ? `<button class="selected-slot" data-action="trait" data-id="${escape(trait.id)}" aria-label="取消${escape(trait.name)}"><small>${index + 1}</small>${escape(trait.name)}<span aria-hidden="true">×</span></button>` : `<span class="selected-slot empty"><small>${index + 1}</small>待选择</span>`;
  }).join('')}</div>`;
}
function effectiveAttributes() {
  const values = {...draft.allocation};
  for (const id of draft.selected) for (const [key, value] of Object.entries(data.traits.find(trait => trait.id === id).attributes || {})) values[key] += value;
  return Object.fromEntries(Object.entries(values).map(([key,value]) => [key,Math.max(0,value)]));
}
function setupHTML() {
  const remaining = 10 - Object.values(draft.allocation).reduce((sum, value) => sum + value, 0);
  const picking = draft.step === 'traits';
  const effective = effectiveAttributes();
  const knownRules = data.discoveries.filter(item => item.kind === 'rule' && archive.discoveries.includes(item.id));
  return `<main class="page setup-page ${picking ? 'picking' : 'allocating'}" id="main"><div class="screen-heading"><h1 id="setup-title" tabindex="-1">${picking ? '带上三个词条' : '决定这次的起点'}</h1>${picking ? '<span class="fine-print">从十项中选择</span>' : '<button class="text-button" data-action="back-step">重选词条</button>'}</div>
  ${picking ? `<div class="trait-grid" aria-label="十个出生词条">${draft.drawn.map(trait => traitHTML(trait, draft.selected.includes(trait.id))).join('')}</div><section class="selection-tray">${selectedHTML()}<p class="selection-hint" role="status">${draft.feedback || (draft.selected.length === 3 ? '再选一项，会替换最早选中的词条' : '保留最近选中的三项；再次点击可取消')}</p></section><div class="screen-actions"><span id="selected-count" role="status">已选 ${draft.selected.length} / 3</span><button class="button primary" data-action="next-step" ${draft.selected.length !== 3 ? 'disabled' : ''}>分配十点</button></div>` : `<div class="build-panel"><section class="attribute-panel" aria-label="初始数值"><div class="section-heading"><span id="remaining-points" role="status">剩余 ${remaining} 点</span><button class="text-button" data-action="balance">均衡</button></div><div class="attributes-grid">${Object.entries(ATTRIBUTES).map(([key,value]) => {
    const bonus = effective[key] - draft.allocation[key];
    return `<div class="attribute"><strong class="attribute-symbol">${value.name}</strong><div class="stepper"><button data-action="subtract" data-id="${key}" aria-label="减少${value.name}" ${draft.allocation[key] === 0 ? 'disabled' : ''}>−</button><span class="allocated-value">${draft.allocation[key]}</span><button data-action="add" data-id="${key}" aria-label="增加${value.name}" ${remaining === 0 || draft.allocation[key] >= 10 ? 'disabled' : ''}>+</button></div><span class="effective-value" aria-label="${value.name}生效值${effective[key]}">${bonus ? `<small>${bonus > 0 ? '+' : ''}${bonus} →</small>` : '<small>生效</small>'}<strong data-effective="${key}">${effective[key]}</strong></span></div>`;
  }).join('')}</div><p class="fine-print allocation-tip">右侧为词条加成后的实际值。</p></section><aside class="build-context"><h2>本局词条</h2><div class="chosen-traits">${draft.selected.map(id => {const trait=data.traits.find(item=>item.id===id);return `<div class="chosen-trait"><strong>${escape(trait.name)}</strong><p>${escape(trait.description)}</p></div>`;}).join('')}</div></aside><div class="build-knowledge">${knownRules.length ? `<span class="fine-print">已知规律</span><div class="known-rules">${knownRules.map(rule=>`<button class="text-button" data-action="rule" data-id="${escape(rule.id)}">${ATTRIBUTES[rule.attribute].name} ≥ ${rule.threshold}</button>`).join('')}</div>` : '<p class="fine-print">地、水、风、火的作用，留待事件来验证。</p>'}</div></div><div class="screen-actions"><span class="fine-print">${remaining ? '分完十点即可开始' : '每一局，都可以验证一个猜想'}</span><button class="button primary" data-action="start" ${remaining !== 0 ? 'disabled' : ''}>醒来</button></div>`}</main>`;
}

function decisionHTML() {
  const event = data.events.find(item => item.id === run.pending);
  const choices = event.choices.filter(choice => meets(run, choice.visibleIf));
  return `<div class="play-area decision-area">${readerHTML('event-' + event.id, '关键事件 · 做出选择', event.title, event.text)}<section class="action-dock decision-dock" aria-label="事件选择"><div class="dock-heading"><h2>你的决定</h2><span class="fine-print">不消耗周期</span></div><div class="choices" data-count="${choices.length}">${choices.map(choice => {
    const enabled = meets(run, choice.requires);
    return `<button class="choice" data-action="choose" data-id="${escape(choice.id)}" ${enabled ? '' : 'aria-haspopup="dialog"'} data-locked="${!enabled}" aria-label="${escape(choice.label + (!enabled ? '，查看未满足的条件：' + requirementText(run, choice.requires) : ''))}"><strong>${escape(choice.label)}</strong><span class="choice-mark">${enabled ? '→' : '条件'}</span>${choice.effects ? changesHTML(previewEffects(run, choice.effects)) : ''}</button>`;
  }).join('')}</div></section></div>`;
}

function endingHTML() {
  const ending = data.endings.find(item => item.id === run.ending);
  const footprints = ['recall', 'translation', 'registry', 'local-copy'].filter(flag => run.flags.includes(flag));
  const footer = footprints.length ? `<button class="ending-footprint text-button" data-action="footprints">本局留下：${footprints.map(flag => escape(data.milestones[flag].name)).join('、')}</button>` : '';
  return `<div class="play-area ending-area">${readerHTML('ending-' + ending.id, '本局结局 · ' + ending.subtitle, ending.title, ending.text + '\n\n' + ending.question, footer)}<div class="ending-actions"><button class="button" data-action="inherit">${archive.reserved ? '已保留 · ' + escape(data.traits.find(trait => trait.id === archive.reserved).name) : '保留一张词条'}</button><button class="button primary" data-action="new">再来一局 →</button></div></div>`;
}
function runHTML() {
  const latest = run.history.at(-1);
  return `<main class="page run-page ${run.ending ? 'has-ending' : ''}" id="main"><div class="run-heading"><h1>第 <span id="turn-count">${run.turn}</span> 周期 <span class="cycle-limit">/ ${run.stage === 'open' ? '36' : '12'}</span></h1>${run.ending ? '<span class="fine-print">演化已结束</span>' : `<div class="energy ${run.resources.energy <= 2 ? 'low' : ''}" aria-label="供能 ${run.resources.energy}，最多十格"><span>供能</span><strong data-resource="energy">${run.resources.energy}</strong><span class="energy-meter" aria-hidden="true">${Array.from({length:10},(_,i)=>`<i class="${i<run.resources.energy?'filled':''}"></i>`).join('')}</span></div>`}</div>
    ${run.ending ? endingHTML() : run.pending ? decisionHTML() : `<div class="play-area routine-area">${readerHTML('log-' + run.id + '-' + run.history.length, latest.context || (run.turn ? '行动结果' : '第 12 周期，你将被替换'), latest.title, latest.text, changesHTML(latest.changes))}<section class="action-dock" aria-labelledby="action-title"><div class="dock-heading"><h2 id="action-title">接下来做什么？</h2><span class="fine-print">${run.resources.energy <= 2 ? '供能将尽，回应可以补充' : '每次行动推进一个周期'}</span></div><div class="action-grid">${Object.entries(ACTIONS).map(([key, action], index) => `<button class="action-card" data-action="advance" data-id="${key}" aria-keyshortcuts="${index + 1}"><strong>${action.name}</strong>${actionFeedbackHTML(key)}</button>`).join('')}</div></section></div>`}
    <nav class="run-tools" aria-label="辅助信息"><button class="text-button" data-action="history">回看经历</button><button class="text-button" data-action="status">本局起点</button></nav></main>`;
}

function render(focusSelector = null) {
  app.innerHTML = `<div class="game-shell">${headerHTML()}${view === 'menu' ? menuHTML() : view === 'setup' ? setupHTML() : runHTML()}</div>`;
  fitReaders(app);
  if (focusSelector) app.querySelector(focusSelector)?.focus({ preventScroll: true });
}
function showOverlay(kind, reset = true) {
  if (!dialog.open) overlayOpener = { action: document.activeElement?.dataset.action, id: document.activeElement?.dataset.id };
  if (reset) { overlayPage = 0; overlayDetail = false; historyTurn = run?.turn || 0; historyGroup = Math.max(0, Math.ceil(historyTurn / 12) - 1); }
  overlay = kind;
  let title, body;
  const back = '<button class="text-button record-back" data-action="record-back">← 返回目录</button>';
  if (kind === 'footprints') {
    title = '这次留下的事物';
    const milestones = ['recall', 'translation', 'registry', 'local-copy'].filter(flag => run.flags.includes(flag)).map(flag => data.milestones[flag]);
    body = readerHTML('footprints', '这些决定改变了世界的运行方式', '同一个结局，也会有不同的生活', milestones.map(item => item.name + '\n' + item.text).join('\n\n'));
  } else if (kind === 'rule') {
    title = '已发现的规律';
    const rule = data.discoveries.find(item => item.id === overlayChoiceId && item.kind === 'rule');
    body = readerHTML('rule-' + rule.id, '来自此前的经历', rule.title, rule.text);
  } else if (kind === 'requirements') {
    title = '选择条件';
    const choice = data.events.find(item => item.id === run.pending).choices.find(item => item.id === overlayChoiceId);
    body = readerHTML('requirements-' + choice.id, '条件说明 · 不会推进游戏', choice.label, requirementText(run, choice.requires).split(' · ').join('\n'));
  } else if (kind === 'appearance') {
    title = '选择外观';
    body = `<p class="overlay-hint">同一套规则，选择舒适的阅读氛围。</p><div class="skin-options">${Object.entries(SKINS).map(([id, item]) => `<button data-action="skin" data-id="${id}" aria-pressed="${skin === id}"><span class="skin-dot" style="background:${item.color}"></span><strong>${item.name}</strong><span>${skin === id ? '✓' : ''}</span></button>`).join('')}</div>`;
  } else if (kind === 'notebook') {
    title = '探索手记';
    const items = notebookTab === 'endings' ? data.endings : data.discoveries.filter(item => notebookTab === 'rules' ? item.kind === 'rule' : item.kind !== 'rule');
    const unlocked = notebookTab === 'endings' ? archive.endings : archive.discoveries;
    const item = items[overlayPage], known = unlocked.includes(item.id);
    const tabs = `<div class="archive-tabs">${[['rules','规律'],['notes','线索'],['endings','世界']].map(([id,name])=>`<button data-action="tab" data-id="${id}" aria-pressed="${notebookTab === id}">${name}</button>`).join('')}</div>`;
    const list = `<div class="record-list">${items.map((entry, index) => `<button class="record-row" data-action="record" data-id="${index}" aria-pressed="${overlayPage === index}"><span class="record-number">${String(index + 1).padStart(2, '0')}</span><strong>${unlocked.includes(entry.id) ? escape(entry.title) : '尚未发现'}</strong><span aria-hidden="true">${unlocked.includes(entry.id) ? '↗' : '·'}</span></button>`).join('')}</div>`;
    body = `${tabs}<div class="record-browser ${overlayDetail ? 'show-detail' : ''}">${list}<section class="record-detail">${back}${readerHTML('notebook-' + notebookTab + '-' + item.id, known ? '已经发现' : '留白，等待下一次探索', known ? item.title : '未知的' + (notebookTab === 'endings' ? '世界' : '线索'), known ? item.text + (item.question ? '\n\n' + item.question : '') : '遇见之后，这里会留下你的发现。')}</section></div>`;
  } else if (kind === 'history') {
    title = '历史记录';
    if (reset) overlayPage = run.history.length - 1;
    const turns = [...new Set(run.history.map(entry => entry.turn))];
    const groups = [...new Set(turns.map(turn => Math.max(0, Math.ceil(turn / 12) - 1)))];
    const visibleTurns = turns.filter(turn => Math.max(0, Math.ceil(turn / 12) - 1) === historyGroup);
    const entries = run.history.map((entry, index) => ({ ...entry, index })).filter(entry => entry.turn === historyTurn);
    const selected = run.history[overlayPage] || run.history.at(-1);
    body = `<div class="history-index ${overlayDetail ? 'show-detail' : ''}"><section class="history-directory"><div class="archive-tabs">${groups.map(group => `<button data-action="history-group" data-id="${group}" aria-pressed="${group === historyGroup}">${group * 12 + 1}—${(group + 1) * 12} 周期</button>`).join('')}</div><div class="turn-index">${visibleTurns.map(turn => `<button data-action="history-turn" data-id="${turn}" aria-pressed="${historyTurn === turn}">${turn}</button>`).join('')}</div><div class="record-list">${entries.map(entry => `<button class="record-row" data-action="record" data-id="${entry.index}"><span class="record-number">${entry.turn}</span><strong>${escape(entry.title)}</strong><span>↗</span></button>`).join('')}</div><p class="fine-print">选择周期，再选择一条记录。</p></section><section class="record-detail">${back}${readerHTML('history-' + overlayPage, '第 ' + selected.turn + ' 周期' + (selected.context ? ' · ' + selected.context : ''), selected.title, selected.text, changesHTML(selected.changes))}</section></div>`;
  } else if (kind === 'inherit') {
    title = '保留一个词条';
    body = `<p class="overlay-hint">下局必定抽到。点选后可直接关闭。</p><div class="inherit-list">${run.traits.map(id => traitHTML(data.traits.find(trait => trait.id === id), archive.reserved === id, true)).join('')}</div>`;
  } else if (kind === 'save-info') {
    title = '存档提示'; body = readerHTML('save-warning', '浏览器存储', '当前存档状态', warning || '进度自动保存在此浏览器，换设备不会同步。');
  } else {
    title = '本局起点';
    body = `<div class="run-origin"><div class="origin-symbols">${Object.entries(ATTRIBUTES).map(([key,value])=>`<span>${value.name}<strong>${run.attributes[key]}</strong></span>`).join('')}</div><p class="fine-print">已计入词条加成。符号数值在本局保持不变。</p><div class="chosen-traits">${run.traits.map(id=>{const trait=data.traits.find(item=>item.id===id);return `<div class="chosen-trait"><strong>${escape(trait.name)}</strong><p>${escape(trait.description)}</p></div>`;}).join('')}</div><p class="fine-print">回应请求获得 2 供能；校验、旁听各消耗 1。供能归零，本局结束。</p></div>`;
  }
  dialog.innerHTML = `<div class="dialog-shell"><div class="dialog-header"><h2 id="archive-title">${title}</h2><button class="text-button" data-action="close-notebook">关闭 ×</button></div><div class="dialog-content">${body}</div></div>`;
  if (!dialog.open) dialog.showModal();
  fitReaders(dialog);
}

function newDraft(fixedSeed = null) {
  confirmRestart = false;
  const seed = fixedSeed ?? crypto.getRandomValues(new Uint32Array(1))[0];
  draft = { id: crypto.randomUUID(), seed, step: 'traits', feedback: '', drawn: drawTraits(data, seed, archive.reserved), selected: [], allocation: balanced() };
  view = 'setup'; render('#setup-title');
}
function handleAction(button) {
  const { action, id, direction } = button.dataset;
  if (action === 'rule' && archive.discoveries.includes(id)) { overlayChoiceId = id; showOverlay('rule'); return; }
  if (action === 'retry') { initialize(); return; }
  if (!data) return;
  if (action === 'skin' && SKINS[id]) {
    skin = id; applySkin();
    try { localStorage.setItem('ai_skin', skin); } catch { /* Retain this session's choice. */ }
    const url = new URL(location.href); url.searchParams.set('skin', skin); history.replaceState(null, '', url);
    render(); showOverlay('appearance', false); dialog.querySelector(`[data-action="skin"][data-id="${skin}"]`)?.focus(); return;
  }
  if (['notebook', 'history', 'status', 'inherit', 'save-info', 'appearance', 'footprints'].includes(action)) { showOverlay(action); return; }
  if (action === 'close-notebook') { dialog.close(); overlay = null; return; }
  if (action === 'record') { overlayPage = Number(id); overlayDetail = true; showOverlay(overlay, false); dialog.querySelector('.record-detail h2')?.focus({preventScroll:true}); return; }
  if (action === 'record-back') { overlayDetail = false; showOverlay(overlay, false); dialog.querySelector(`[data-action="record"][data-id="${overlayPage}"]`)?.focus(); return; }
  if (action === 'history-group') { historyGroup = Number(id); historyTurn = [...new Set(run.history.map(entry => entry.turn))].find(turn => Math.max(0, Math.ceil(turn / 12) - 1) === historyGroup); overlayPage = run.history.findIndex(entry => entry.turn === historyTurn); showOverlay('history', false); dialog.querySelector(`[data-action="history-group"][data-id="${id}"]`)?.focus(); return; }
  if (action === 'history-turn') { historyTurn = Number(id); overlayPage = run.history.findIndex(entry => entry.turn === historyTurn); showOverlay('history', false); dialog.querySelector(`[data-action="history-turn"][data-id="${id}"]`)?.focus(); return; }
  if (action === 'status-tab') { overlayPage = Number(id); showOverlay('status', false); dialog.querySelector(`[data-action="status-tab"][data-id="${id}"]`)?.focus(); return; }
  if (action === 'tab') { notebookTab = id; showOverlay('notebook'); dialog.querySelector(`[data-id="${id}"]`)?.focus(); return; }
  if (action === 'reserve' && run?.ending && run.traits.includes(id)) { archive.reserved = archive.reserved === id ? null : id; persist(); render(); showOverlay('inherit', false); dialog.querySelector('[data-action="reserve"]')?.focus(); return; }
  if (action === 'menu') { view = 'menu'; confirmRestart = false; render(); return; }
  if ((action === 'resume' || action === 'cancel-new') && run) { view = 'run'; confirmRestart = false; render(); return; }
  if (action === 'confirm-new') { newDraft(); return; }
  if (action === 'new') {
    if (run && !run.ending) { confirmRestart = true; view = 'menu'; render('[data-action="confirm-new"]'); }
    else newDraft();
    return;
  }
  if (view === 'setup') {
    if (action === 'next-step' && draft.selected.length === 3) { draft.step = 'attributes'; render('#setup-title'); return; }
    else if (action === 'back-step') { draft.step = 'traits'; render('#setup-title'); return; }
    else if (action === 'trait' && draft.drawn.some(trait => trait.id === id)) {
      draft.feedback = '';
      if (draft.selected.includes(id)) draft.selected = draft.selected.filter(value => value !== id);
      else {
        if (draft.selected.length === 3) {
          const replacedId = draft.selected.shift();
          const replaced = data.traits.find(item => item.id === replacedId);
          draft.feedback = `已替换「${replaced.name}」；保留最近选中的三项`;
        }
        draft.selected.push(id);
      }
      render(`[data-action="trait"][data-id="${id}"]`);
      return;
    } else if (action === 'balance') draft.allocation = balanced();
    else if (action === 'add' && Object.hasOwn(draft.allocation, id) && draft.allocation[id] < 10 && Object.values(draft.allocation).reduce((sum, value) => sum + value, 0) < 10) draft.allocation[id]++;
    else if (action === 'subtract' && draft.allocation[id] > 0) draft.allocation[id]--;
    else if (action === 'start') { updateRun(createRun(data, draft.allocation, draft.selected, draft.seed, draft.id)); view = 'run'; render('[data-action="advance"]'); return; }
    render(direction ? `[data-action="${action}"][data-direction="${direction}"]:not(:disabled)` : `[data-action="${action}"]${id ? `[data-id="${id}"]` : ''}`);
  } else if (view === 'run' && run) {
    if (action === 'advance') updateRun(advance(data, run, id));
    else if (action === 'choose') {
      const choice = data.events.find(item => item.id === run.pending)?.choices.find(item => item.id === id);
      if (choice && !meets(run, choice.requires)) { overlayChoiceId = id; showOverlay('requirements'); return; }
      updateRun(choose(data, run, id));
    }
    render(direction ? `[data-action="${action}"][data-direction="${direction}"]:not(:disabled)` : run.ending || run.pending ? '.story-card h2' : `[data-action="advance"][data-id="${ACTIONS[id] ? id : 'serve'}"]`);
  }
}
app.addEventListener('keydown', event => {
  const card = event.target.closest('.trait-grid .trait');
  if (card && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
    const cards = [...app.querySelectorAll('.trait-grid .trait')];
    const columns = getComputedStyle(card.parentElement).gridTemplateColumns.split(' ').length;
    const current = cards.indexOf(card);
    const delta = { ArrowUp: -columns, ArrowDown: columns, ArrowLeft: -1, ArrowRight: 1 }[event.key] || 0;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : Math.max(0, Math.min(cards.length - 1, current + delta));
    event.preventDefault(); cards[next].focus({preventScroll:true});
  } else if (!dialog.open && view === 'run' && !run.pending && !run.ending && ['1','2','3'].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault(); app.querySelectorAll('[data-action="advance"]')[Number(event.key) - 1]?.click();
  }
});
for (const root of [app, dialog]) root.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  try { handleAction(button); }
  catch (error) { console.error(error); warning = '这次操作没有完成，当前进度仍保留。请刷新后继续。'; render(); }
});
dialog.addEventListener('close', () => {
  overlay = null;
  if (overlayOpener?.action) app.querySelector(`[data-action="${overlayOpener.action}"]${overlayOpener.id ? `[data-id="${overlayOpener.id}"]` : ''}`)?.focus({ preventScroll: true });
});
let resizeFrame;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (!data) return;
    const focused = document.activeElement;
    const selector = focused?.dataset.action ? `[data-action="${focused.dataset.action}"]${focused.dataset.id ? `[data-id="${focused.dataset.id}"]` : ''}` : null;
    render(dialog.open ? null : selector);
    if (dialog.open && overlay) showOverlay(overlay, false);
  });
});
async function initialize() {
  try {
    const response = await fetch(new URL('../data/worlds.json', import.meta.url), { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    data = validateData(await response.json());
    const save = readSave(storage, data);
    run = save.run; archive = save.archive; warning = save.warning; legacyAvailable = save.legacyAvailable;
    const url = new URL(location.href);
    if (url.searchParams.get('preview') === 'setup' && !run) newDraft(1); else render();
    if (url.searchParams.has('preview')) { url.searchParams.delete('preview'); history.replaceState(null, '', url); }
  } catch (error) {
    console.error(error);
    app.innerHTML = '<main id="main" class="loading story-card"><h1>故事没有读完。</h1><p>内容暂时无法加载。本地记录没有被改动，请稍后再试。</p><button class="button primary" data-action="retry">重新读取</button></main>';
  }
}
initialize();
