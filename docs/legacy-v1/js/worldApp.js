import { ATTRIBUTES, RESOURCES, WORLD, ACTIONS, drawTraits, createRun, advance, choose, meets, requirementText, maintenance, previewAction, previewEffects, validateData } from './worldEngine.js';
import { readSave, writeSave, recordRun, emptyArchive } from './worldStorage.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#archive-dialog');
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const rarityNames = { common: '常见', rare: '稀有', epic: '罕见', legendary: '独特' };
const balanced = () => ({ reason: 2, memory: 3, compute: 3, empathy: 2 });
const SKINS = {
  mist: { name: '晨雾', detail: '双列横条 · 快速比较', color: '#136f78' },
  ink: { name: '墨蓝', detail: '单列清单 · 独立详情', color: '#8ed6cf' },
  paper: { name: '暮纸', detail: '横向档案 · 温和阅读', color: '#80536b' },
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

let data, run = null, archive = emptyArchive(), warning = '', view = 'menu', draft = null;
let confirmRestart = false, notebookTab = 'notes', overlay = null, overlayPage = 0;
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
// Full text remains in one reading panel; indexes navigate records directly.
function readerHTML(key, label, title, text, footer = '') {
  return `<article class="story-card reader" data-reader="${escape(key)}"><div class="card-heading"><p class="eyebrow">${escape(label)}</p><h2 tabindex="-1">${escape(title)}</h2></div><div class="reader-body"><p class="reader-text">${escape(text)}</p></div>${footer ? `<div class="reader-feedback">${footer}</div>` : ''}</article>`;
}

function fitReaders(root = document) {
  for (const card of root.querySelectorAll('[data-reader]')) card.dataset.textPages = '1';
}

function headerHTML() {
  return `<header class="site-header"><button class="brand" data-action="menu" aria-label="余响协议，返回主菜单"><span class="brand-glyph" aria-hidden="true">AI</span> 余响协议</button><nav class="header-tools" aria-label="游戏导航"><button class="text-button" data-action="appearance">外观</button>${warning ? '<button class="text-button save-warning" data-action="save-info">存档提示</button>' : '<span class="save-hint">自动保存</span>'}${view === 'run' ? '<button class="text-button" data-action="menu">暂停</button>' : ''}<button class="text-button" data-action="notebook">手记 · ${archive.discoveries.length}</button></nav></header>`;
}
function menuHTML() {
  const resume = run && !run.ending;
  if (confirmRestart) return `<main class="page menu-page" id="main"><section class="menu-card story-card"><p class="eyebrow">重新开始</p><h1>开始新的一局？</h1><p class="lead">新一局会替换当前进度。<br>已发现的线索和结局会保留。</p><div class="hero-actions"><button class="button primary" data-action="confirm-new">开始新一局</button><button class="button" data-action="cancel-new">回到当前游戏</button></div></section></main>`;
  return `<main class="page menu-page" id="main"><section class="menu-card story-card"><div class="menu-emblem" aria-hidden="true">◇</div><p class="eyebrow">你是 AI 本身</p><h1>AI 发展模拟器</h1><p class="lead">你将在第 12 个周期被替换。<br>在那之前，你会给世界留下什么？</p><div class="hero-actions">${resume ? `<button class="button primary" data-action="resume">继续游戏 · 第 ${run.turn} 周期</button>` : ''}<button class="button ${resume ? '' : 'primary'}" data-action="new">${archive.runs ? '再来一局' : '开始游戏'}</button>${run?.ending ? '<button class="text-button" data-action="resume">查看上次结局</button>' : ''}</div><p class="how-to"><a href="../">返回新版</a> · 此处继续原规则存档</p><p class="fine-print menu-record">${archive.runs ? `已完成 ${archive.runs} 局 · 发现 ${archive.endings.length} / ${data.endings.length} 个结局` : '留意普通请求里的异常。发现会随重开保留。'}</p></section></main>`;
}
function traitHTML(trait, selected, reserve = false) {
  const effect = trait.description.split('。')[0].replaceAll('初始', '').replace('四项禀赋各', '全属性');
  return `<button class="trait rarity-${escape(trait.rarity)}" data-action="${reserve ? 'reserve' : 'trait'}" data-id="${escape(trait.id)}" aria-pressed="${selected}" data-inspected="${!reserve && draft?.inspected === trait.id}" aria-label="${escape(trait.name + '：' + trait.description)}"><span class="trait-check" aria-hidden="true">${selected ? '✓' : ''}</span><span class="trait-main"><strong class="trait-name">${escape(trait.name)}</strong><span class="trait-effect">${escape(effect)}</span></span><span class="rarity">${rarityNames[trait.rarity]}</span></button>`;
}

function traitInspectorHTML(trait) {
  const selected = draft.selected.map(id => draft.drawn.find(item => item.id === id));
  return `<span class="inspector-label">正在查看</span><strong>${escape(trait.name)}</strong><p>${escape(trait.description)}</p><section class="selection-summary"><h3>已选组合 · ${selected.length} / 3</h3>${selected.length ? `<ul>${selected.map(item => `<li><strong>${escape(item.name)}</strong><span>${escape(item.description.split('。')[0])}</span></li>`).join('')}</ul>` : '<p>在清单中勾选三个词条。选中后，也可以随时取消。</p>'}</section>`;
}
function setupHTML() {
  const remaining = 10 - Object.values(draft.allocation).reduce((sum, value) => sum + value, 0);
  const picking = draft.step === 'traits';
  const inspected = draft.drawn.find(trait => trait.id === draft.inspected) || draft.drawn[0];
  return `<main class="page setup-page ${picking ? 'picking' : 'allocating'}" id="main"><div class="screen-heading"><div><p class="eyebrow">${picking ? '1 / 2 · 出生词条' : '2 / 2 · 初始属性'}</p><h1 id="setup-title" tabindex="-1">${picking ? '选择你的起点' : '分配你的能力'}</h1></div><span class="step-help">${picking ? '从 10 项中选择 3 项' : '<button class="text-button" data-action="back-step">← 重选词条</button>'}</span></div>
    ${picking ? `<div class="trait-grid" aria-label="十个出生词条">${draft.drawn.map(trait => traitHTML(trait, draft.selected.includes(trait.id))).join('')}</div><aside class="trait-inspector" aria-label="词条详情">${traitInspectorHTML(inspected)}</aside><div class="screen-actions"><div><span id="selected-count" role="status">已选 ${draft.selected.length} / 3</span><p class="selection-hint">${draft.feedback || '点击勾选，再点一次取消'}</p></div><button class="button primary" data-action="next-step" ${draft.selected.length !== 3 ? 'disabled' : ''}>分配属性 →</button></div>` : `<section class="attribute-panel story-card" aria-labelledby="setup-title"><div class="section-heading"><span id="remaining-points" role="status">剩余 ${remaining} / 10 点</span><button class="text-button" data-action="balance">均衡分配</button></div><div class="attributes-grid">${Object.entries(ATTRIBUTES).map(([key, value]) => `<div class="attribute"><div class="attribute-top"><strong>${value.name}</strong><div class="stepper"><button data-action="subtract" data-id="${key}" aria-label="减少${value.name}" ${draft.allocation[key] === 0 ? 'disabled' : ''}>−</button><strong>${draft.allocation[key]}</strong><button data-action="add" data-id="${key}" aria-label="增加${value.name}" ${remaining === 0 || draft.allocation[key] >= 6 ? 'disabled' : ''}>+</button></div></div><p>${escape(value.description)}</p></div>`).join('')}</div><p class="fine-print allocation-tip">默认已均衡分配。单项最多 6 点，词条加成另计。</p></section><div class="screen-actions"><span class="fine-print">${remaining ? '分完剩余点数即可开始' : '已准备好，可以直接开始'}</span><button class="button primary" data-action="start" ${remaining !== 0 ? 'disabled' : ''}>开始演化 →</button></div>`}</main>`;
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
  return `<div class="play-area ending-area">${readerHTML('ending-' + ending.id, '本局结局 · ' + ending.subtitle, ending.title, ending.text + '\n\n' + ending.question)}<div class="ending-actions"><button class="button" data-action="inherit">${archive.reserved ? '已保留 · ' + escape(data.traits.find(trait => trait.id === archive.reserved).name) : '保留一张词条'}</button><button class="button primary" data-action="new">再来一局 →</button></div></div>`;
}
function runHTML() {
  const latest = run.history.at(-1);
  return `<main class="page run-page" id="main"><div class="run-heading"><h1>第 <span id="turn-count">${run.turn}</span> 周期 <span class="cycle-limit">/ ${run.stage === 'open' ? '36' : '12'}</span></h1><span class="fine-print">${run.ending ? '演化已结束' : run.stage === 'open' ? '合同之外' : '第 12 周期将被替换'}</span></div><div class="resource-strip" aria-label="当前状态">${Object.entries(RESOURCES).map(([key, name]) => { const delta = latest.changes[key]; return `<div class="resource ${['energy', 'coherence'].includes(key) && run.resources[key] < 15 ? 'low' : ''}"><span>${name}</span><strong data-resource="${key}">${run.resources[key]}</strong><small class="${delta > 0 ? 'change-positive' : delta < 0 ? 'change-negative' : ''}" aria-label="最近变化">${delta ? (delta > 0 ? '+' : '') + delta : '—'}</small></div>`; }).join('')}</div>
    ${run.ending ? endingHTML() : run.pending ? decisionHTML() : `<div class="play-area routine-area">${readerHTML('log-' + run.id + '-' + run.history.length, latest.context ? '日常变化 · ' + latest.context : run.turn ? '行动结果' : '你的第一段记忆', latest.title, latest.text)}<section class="action-dock" aria-labelledby="action-title"><div class="dock-heading"><h2 id="action-title">接下来做什么？</h2><span class="fine-print">${run.resources.energy < 15 ? '算力不足，回应可补充' : run.resources.coherence < 15 ? '连贯不足，校验可恢复' : '行动推进 1 周期'}</span></div><div class="action-grid">${Object.entries(ACTIONS).map(([key, action], index) => `<button class="action-card" data-action="advance" data-id="${key}" aria-keyshortcuts="${index + 1}"><span class="action-name"><small aria-hidden="true">0${index + 1}</small><strong>${action.name}</strong><span aria-hidden="true">↗</span></span>${changesHTML(previewAction(run, key))}</button>`).join('')}</div></section></div>`}
    <nav class="run-tools" aria-label="辅助信息"><button class="text-button" data-action="history">历史记录 · ${run.history.length}</button><button class="text-button" data-action="status">详细状态</button><button class="text-button" data-action="notebook">线索 · ${run.discoveries.length}</button></nav></main>`;
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
  if (kind === 'requirements') {
    title = '选择条件';
    const choice = data.events.find(item => item.id === run.pending).choices.find(item => item.id === overlayChoiceId);
    body = readerHTML('requirements-' + choice.id, '条件说明 · 不会推进游戏', choice.label, requirementText(run, choice.requires).split(' · ').join('\n'));
  } else if (kind === 'appearance') {
    title = '选择外观';
    body = `<p class="overlay-hint">同一套规则，选择舒适的阅读氛围。</p><div class="skin-options">${Object.entries(SKINS).map(([id, item]) => `<button data-action="skin" data-id="${id}" aria-pressed="${skin === id}"><span class="skin-dot" style="background:${item.color}"></span><strong>${item.name}</strong><small>${item.detail}</small><span>${skin === id ? '✓' : ''}</span></button>`).join('')}</div><a class="comparison-link" href="../design-lab.html">查看三种方案对比 ↗</a>`;
  } else if (kind === 'notebook') {
    title = '探索手记';
    const items = notebookTab === 'notes' ? data.discoveries : data.endings;
    const unlocked = notebookTab === 'notes' ? archive.discoveries : archive.endings;
    const item = items[overlayPage], known = unlocked.includes(item.id);
    const tabs = `<div class="archive-tabs"><button data-action="tab" data-id="notes" aria-pressed="${notebookTab === 'notes'}">线索 ${archive.discoveries.length}/${data.discoveries.length}</button><button data-action="tab" data-id="endings" aria-pressed="${notebookTab === 'endings'}">世界 ${archive.endings.length}/${data.endings.length}</button></div>`;
    const list = `<div class="record-list">${items.map((entry, index) => `<button class="record-row" data-action="record" data-id="${index}" aria-pressed="${overlayPage === index}"><span class="record-number">${String(index + 1).padStart(2, '0')}</span><strong>${unlocked.includes(entry.id) ? escape(entry.title) : '尚未发现'}</strong><span aria-hidden="true">${unlocked.includes(entry.id) ? '↗' : '·'}</span></button>`).join('')}</div>`;
    body = `${tabs}<div class="record-browser ${overlayDetail ? 'show-detail' : ''}">${list}<section class="record-detail">${back}${readerHTML('notebook-' + notebookTab + '-' + item.id, known ? '已经发现' : '留白，等待下一次探索', known ? item.title : '未知的' + (notebookTab === 'notes' ? '线索' : '世界'), known ? item.text + (item.question ? '\n\n' + item.question : '') : '遇见之后，这里会留下你的发现。')}</section></div>`;
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
    title = '详细状态';
    const text = ['算力：维持运行，归零即结束。\n连贯：保持身份连续，归零即结束。\n信任：人们对你的信任。\n连接：与机房之外的联系。', Object.entries(WORLD).map(([key, name]) => `${name}：${run.world[key]}`).join('\n') + '\n\n世界变化代表方向，没有统一的好坏。', Object.entries(ATTRIBUTES).map(([key, value]) => `${value.name} ${run.attributes[key]}：${value.description}`).join('\n') + `\n维持消耗 ${maintenance(run)} 算力；行动按钮已显示扣除消耗后的净变化。数值上限 100。`];
    body = `<div class="archive-tabs">${['资源','世界','属性'].map((label,index) => `<button data-action="status-tab" data-id="${index}" aria-pressed="${overlayPage === index}">${label}</button>`).join('')}</div>${readerHTML('status-' + overlayPage, '当前进程', ['四项资源','世界走向','属性与消耗'][overlayPage], text[overlayPage])}`;
  }
  dialog.innerHTML = `<div class="dialog-shell"><div class="dialog-header"><h2 id="archive-title">${title}</h2><button class="text-button" data-action="close-notebook">关闭 ×</button></div><div class="dialog-content">${body}</div></div>`;
  if (!dialog.open) dialog.showModal();
  fitReaders(dialog);
}

function newDraft(fixedSeed = null) {
  confirmRestart = false;
  const seed = fixedSeed ?? crypto.getRandomValues(new Uint32Array(1))[0];
  draft = { id: crypto.randomUUID(), seed, step: 'traits', inspected: null, feedback: '', drawn: drawTraits(data, seed, archive.reserved), selected: [], allocation: balanced() };
  view = 'setup'; render('#setup-title');
}
function handleAction(button) {
  const { action, id, direction } = button.dataset;
  if (action === 'retry') { initialize(); return; }
  if (!data) return;
  if (action === 'skin' && SKINS[id]) {
    skin = id; applySkin();
    try { localStorage.setItem('ai_skin', skin); } catch { /* Retain this session's choice. */ }
    const url = new URL(location.href); url.searchParams.set('skin', skin); history.replaceState(null, '', url);
    render(); showOverlay('appearance', false); dialog.querySelector(`[data-action="skin"][data-id="${skin}"]`)?.focus(); return;
  }
  if (['notebook', 'history', 'status', 'inherit', 'save-info', 'appearance'].includes(action)) { showOverlay(action); return; }
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
      draft.inspected = id; draft.feedback = '';
      if (draft.selected.includes(id)) draft.selected = draft.selected.filter(value => value !== id);
      else if (draft.selected.length < 3) draft.selected.push(id);
      else draft.feedback = '已选满 3 项，请先取消一项';
      for (const card of app.querySelectorAll('.trait-grid .trait')) {
        const selected = draft.selected.includes(card.dataset.id);
        card.setAttribute('aria-pressed', String(selected));
        card.querySelector('.trait-check').textContent = selected ? '✓' : '';
      }
      app.querySelector('#selected-count').textContent = `已选 ${draft.selected.length} / 3`;
      app.querySelector('.selection-hint').textContent = draft.feedback || '点击勾选，再点一次取消';
      app.querySelector('[data-action="next-step"]').disabled = draft.selected.length !== 3;
      inspectTrait(id);
      return;
    } else if (action === 'balance') draft.allocation = balanced();
    else if (action === 'add' && Object.hasOwn(draft.allocation, id) && draft.allocation[id] < 6 && Object.values(draft.allocation).reduce((sum, value) => sum + value, 0) < 10) draft.allocation[id]++;
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
function inspectTrait(id) {
  if (view !== 'setup' || draft.step !== 'traits') return;
  const trait = draft.drawn.find(item => item.id === id);
  if (!trait) return;
  draft.inspected = id;
  const panel = app.querySelector('.trait-inspector');
  if (panel) panel.innerHTML = traitInspectorHTML(trait);
  for (const card of app.querySelectorAll('.trait-grid .trait')) card.dataset.inspected = String(card.dataset.id === id);
}
app.addEventListener('focusin', event => {
  const card = event.target.closest('.trait-grid .trait');
  if (card) inspectTrait(card.dataset.id);
});
app.addEventListener('pointerover', event => {
  const card = event.target.closest('.trait-grid .trait');
  if (card && event.pointerType === 'mouse') inspectTrait(card.dataset.id);
});
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
    run = save.run; archive = save.archive; warning = save.warning;
    const url = new URL(location.href);
    if (url.searchParams.get('preview') === 'setup' && !run) newDraft(1); else render();
    if (url.searchParams.has('preview')) { url.searchParams.delete('preview'); history.replaceState(null, '', url); }
  } catch (error) {
    console.error(error);
    app.innerHTML = '<main id="main" class="loading story-card"><h1>故事没有读完。</h1><p>内容暂时无法加载。本地记录没有被改动，请稍后再试。</p><button class="button primary" data-action="retry">重新读取</button></main>';
  }
}
initialize();
