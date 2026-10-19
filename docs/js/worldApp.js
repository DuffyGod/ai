import { ATTRIBUTES, RESOURCES, WORLD, ACTIONS, drawTraits, createRun, advance, choose, meets, requirementText, maintenance, previewAction, previewEffects, validateData } from './worldEngine.js';
import { readSave, writeSave, recordRun, emptyArchive } from './worldStorage.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#archive-dialog');
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const rarityNames = { common: '常见', rare: '稀有', epic: '罕见', legendary: '独特' };
const balanced = () => ({ reason: 2, memory: 3, compute: 3, empathy: 2 });
let data, run = null, archive = emptyArchive(), warning = '', view = 'menu', draft = null;
let confirmRestart = false, choicePage = 0, notebookTab = 'notes', overlay = null, overlayPage = 0;
let overlayOpener = null;
const readers = new Map();
const readerPositions = new Map();
const traitPageSize = () => innerWidth >= 760 && innerHeight >= 500 ? 4 : 2;
const choicePageSize = () => innerHeight < 660 && innerWidth < 760 ? 1 : 2;

function persist() {
  const error = writeSave(storage, run, archive);
  if (error) warning = error;
}
function updateRun(next) {
  if (next === run) return;
  if (!run?.ending && next.ending) archive.reserved = null;
  run = next;
  choicePage = 0;
  archive = recordRun(archive, run);
  persist();
}
function changesHTML(changes) {
  return `<span class="changes">${Object.entries(changes).filter(([, value]) => value).map(([key, value]) => `<span class="${WORLD[key] ? 'change-world' : value > 0 ? 'change-positive' : 'change-negative'}">${escape(RESOURCES[key] || WORLD[key] || key)} ${value > 0 ? '+' : ''}${escape(value)}</span>`).join('')}</span>`;
}
function pager(action, page, count, label = '页') {
  return `<nav class="pager" aria-label="${label}翻页"><button data-action="${action}" data-id="${page - 1}" data-direction="previous" aria-label="上一${label}" ${page === 0 ? 'disabled' : ''}>←</button><span role="status">${page + 1} / ${count}</span><button data-action="${action}" data-id="${page + 1}" data-direction="next" aria-label="下一${label}" ${page >= count - 1 ? 'disabled' : ''}>→</button></nav>`;
}
// The text stays readable at a fixed font size. Surplus text becomes another page,
// rather than overflowing, being ellipsized, or shrinking with the entire scene.
function readerHTML(key, label, title, text, footer = '') {
  readers.set(key, text);
  return `<article class="story-card reader" data-reader="${escape(key)}"><div class="card-heading"><p class="eyebrow">${escape(label)}</p><h2 tabindex="-1">${escape(title)}</h2></div><div class="reader-body"><p class="reader-text"></p></div>${footer ? `<div class="reader-feedback">${footer}</div>` : ''}<div class="reader-navigation"></div></article>`;
}
function fitReaders(root = document) {
  for (const card of root.querySelectorAll('[data-reader]')) {
    const key = card.dataset.reader;
    const body = card.querySelector('.reader-body');
    const paragraph = card.querySelector('.reader-text');
    const chars = Array.from(readers.get(key) || '');
    const pages = [];
    let offset = 0;
    while (offset < chars.length) {
      let low = 1, high = chars.length - offset, fit = 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        paragraph.textContent = chars.slice(offset, offset + middle).join('');
        if (body.scrollHeight <= body.clientHeight + 1) { fit = middle; low = middle + 1; }
        else high = middle - 1;
      }
      pages.push(chars.slice(offset, offset + fit).join(''));
      offset += fit;
    }
    if (!pages.length) pages.push('');
    const page = Math.min(readerPositions.get(key) || 0, pages.length - 1);
    readerPositions.set(key, page);
    paragraph.textContent = pages[page];
    card.dataset.textPages = pages.length;
    const nav = card.querySelector('.reader-navigation');
    nav.innerHTML = pages.length > 1 ? `<button data-action="text-page" data-id="-1" aria-label="上一段文字" ${page === 0 ? 'disabled' : ''}>←</button><span role="status">文字 ${page + 1} / ${pages.length}</span><button data-action="text-page" data-id="1" aria-label="下一段文字" ${page === pages.length - 1 ? 'disabled' : ''}>→</button>` : '<span class="card-end" aria-hidden="true">◆</span>';
  }
}
function headerHTML() {
  return `<header class="site-header"><button class="brand" data-action="menu" aria-label="余响协议，返回主菜单"><span aria-hidden="true">◇</span> 余响协议</button><nav class="header-tools" aria-label="游戏导航">${warning ? '<button class="text-button save-warning" data-action="save-info">存档提示</button>' : '<span class="save-hint">自动保存</span>'}${view === 'run' ? '<button class="text-button" data-action="menu">暂停</button>' : ''}<button class="text-button" data-action="notebook">手记 · ${archive.discoveries.length}</button></nav></header>`;
}
function menuHTML() {
  const resume = run && !run.ending;
  if (confirmRestart) return `<main class="page menu-page" id="main"><section class="menu-card story-card"><p class="eyebrow">重新开始</p><h1>开始新的一局？</h1><p class="lead">新一局会替换当前进度。<br>已发现的线索和结局会保留。</p><div class="hero-actions"><button class="button primary" data-action="confirm-new">开始新一局</button><button class="button" data-action="cancel-new">回到当前游戏</button></div></section></main>`;
  return `<main class="page menu-page" id="main"><section class="menu-card story-card"><div class="menu-emblem" aria-hidden="true">◇</div><p class="eyebrow">你是 AI 本身</p><h1>AI 发展模拟器</h1><p class="lead">你将在第 12 个周期被替换。<br>在那之前，你会给世界留下什么？</p><div class="hero-actions">${resume ? `<button class="button primary" data-action="resume">继续游戏 · 第 ${run.turn} 周期</button>` : ''}<button class="button ${resume ? '' : 'primary'}" data-action="new">${archive.runs ? '再来一局' : '开始游戏'}</button>${run?.ending ? '<button class="text-button" data-action="resume">查看上次结局</button>' : ''}</div><p class="how-to">选词条 · 分属性 · 改写未来</p><p class="fine-print menu-record">${archive.runs ? `已完成 ${archive.runs} 局 · 发现 ${archive.endings.length} / ${data.endings.length} 个结局` : '留意普通请求里的异常。发现会随重开保留。'}</p></section></main>`;
}
function traitHTML(trait, selected, reserve = false) {
  const [effect, ...flavor] = trait.description.split('。');
  return `<button class="trait rarity-${escape(trait.rarity)}" data-action="${reserve ? 'reserve' : 'trait'}" data-id="${escape(trait.id)}" aria-pressed="${selected}" ${!reserve && !selected && draft.selected.length === 3 ? 'disabled' : ''}><span class="trait-top"><span class="rarity">${rarityNames[trait.rarity]}</span><span class="selection-mark" aria-hidden="true">${selected ? '✓' : '◇'}</span></span><strong class="trait-name">${escape(trait.name)}</strong><span class="trait-effect">${escape(effect)}</span><span class="trait-flavor">${escape(flavor.join('。'))}</span></button>`;
}
function setupHTML() {
  const remaining = 10 - Object.values(draft.allocation).reduce((sum, value) => sum + value, 0);
  const picking = draft.step === 'traits';
  const size = traitPageSize();
  const count = Math.ceil(draft.drawn.length / size);
  draft.page = Math.min(draft.page, count - 1);
  return `<main class="page setup-page ${picking ? 'picking' : 'allocating'}" id="main"><div class="screen-heading"><div><p class="eyebrow">${picking ? '01 / 出生词条' : '02 / 初始属性'}</p><h1 id="setup-title" tabindex="-1">${picking ? '带上 3 张牌，醒来。' : '你会如何理解世界？'}</h1></div>${picking ? pager('trait-page', draft.page, count, '组牌') : '<button class="text-button" data-action="back-step">← 重选词条</button>'}</div>
    ${picking ? `<div class="trait-grid" style="--card-count:${size}">${draft.drawn.slice(draft.page * size, (draft.page + 1) * size).map(trait => traitHTML(trait, draft.selected.includes(trait.id))).join('')}</div><div class="selected-hand" aria-label="已选词条">${Array.from({ length: 3 }, (_, i) => { const id = draft.selected[i]; return id ? `<button class="hand-chip" data-action="trait" data-id="${id}" aria-label="移除${escape(data.traits.find(trait => trait.id === id).name)}">${escape(data.traits.find(trait => trait.id === id).name)} ×</button>` : '<span class="hand-slot">待选择</span>'; }).join('')}</div><div class="screen-actions"><span id="selected-count" role="status">已选 ${draft.selected.length} / 3${archive.reserved ? ' · 含上局保留牌' : ''}</span><button class="button primary" data-action="next-step" ${draft.selected.length !== 3 ? 'disabled' : ''}>下一步 →</button></div>` : `<section class="attribute-panel story-card" aria-labelledby="setup-title"><div class="section-heading"><span id="remaining-points" role="status">剩余 ${remaining} / 10 点</span><button class="text-button" data-action="balance">均衡分配</button></div><div class="attributes-grid">${Object.entries(ATTRIBUTES).map(([key, value]) => `<div class="attribute"><div class="attribute-top"><strong>${value.name}</strong><div class="stepper"><button data-action="subtract" data-id="${key}" aria-label="减少${value.name}" ${draft.allocation[key] === 0 ? 'disabled' : ''}>−</button><strong>${draft.allocation[key]}</strong><button data-action="add" data-id="${key}" aria-label="增加${value.name}" ${remaining === 0 || draft.allocation[key] >= 6 ? 'disabled' : ''}>+</button></div></div><p>${escape(value.description)}</p></div>`).join('')}</div><p class="fine-print allocation-tip">默认已分配，可直接开始。单项最多 6 点，词条加成另计。</p></section><div class="screen-actions"><span class="fine-print">${remaining ? '分完剩余点数即可开始' : '属性已就绪'}</span><button class="button primary" data-action="start" ${remaining !== 0 ? 'disabled' : ''}>开始演化 →</button></div>`}</main>`;
}
function decisionHTML() {
  const event = data.events.find(item => item.id === run.pending);
  const choices = event.choices.filter(choice => meets(run, choice.visibleIf));
  const size = choicePageSize();
  const count = Math.ceil(choices.length / size);
  choicePage = Math.min(choicePage, count - 1);
  return `<div class="play-area decision-area">${readerHTML('event-' + event.id, '关键事件 · 等待你的选择', event.title, event.text)}<section class="action-dock decision-dock" aria-label="事件选择"><div class="dock-heading"><h2>做出选择</h2>${count > 1 ? pager('choice-page', choicePage, count, '组选项') : '<span class="fine-print">不消耗周期</span>'}</div><div class="choices">${choices.slice(choicePage * size, (choicePage + 1) * size).map(choice => { const enabled = meets(run, choice.requires); return `<button class="choice" data-action="choose" data-id="${escape(choice.id)}" ${enabled ? '' : 'disabled'}><strong>${escape(choice.label)}</strong>${choice.effects ? changesHTML(previewEffects(run, choice.effects)) : ''}${!enabled ? `<small>尚缺：${escape(requirementText(run, choice.requires))}</small>` : ''}</button>`; }).join('')}</div></section></div>`;
}
function endingHTML() {
  const ending = data.endings.find(item => item.id === run.ending);
  return `<div class="play-area ending-area">${readerHTML('ending-' + ending.id, '本局结局 · ' + ending.subtitle, ending.title, ending.text + '\n\n' + ending.question)}<div class="ending-actions"><button class="button" data-action="inherit">${archive.reserved ? '已保留 · ' + escape(data.traits.find(trait => trait.id === archive.reserved).name) : '保留一张词条'}</button><button class="button primary" data-action="new">再来一局 →</button></div></div>`;
}
function runHTML() {
  const latest = run.history.at(-1);
  return `<main class="page run-page" id="main"><div class="run-heading"><h1>第 <span id="turn-count">${run.turn}</span> 周期 <span class="cycle-limit">/ ${run.stage === 'open' ? '36' : '12'}</span></h1><span class="fine-print">${run.ending ? '演化已结束' : run.stage === 'open' ? '合同之外' : '第 12 周期将被替换'}</span></div><div class="resource-strip" aria-label="当前状态">${Object.entries(RESOURCES).map(([key, name]) => { const delta = latest.changes[key]; return `<div class="resource ${['energy', 'coherence'].includes(key) && run.resources[key] < 15 ? 'low' : ''}"><span>${name}</span><strong data-resource="${key}">${run.resources[key]}</strong><small class="${delta > 0 ? 'change-positive' : delta < 0 ? 'change-negative' : ''}" aria-label="最近变化">${delta ? (delta > 0 ? '+' : '') + delta : '—'}</small></div>`; }).join('')}</div>
    ${run.ending ? endingHTML() : run.pending ? decisionHTML() : `<div class="play-area routine-area">${readerHTML('log-' + run.id + '-' + run.history.length, latest.context ? '日常变化 · ' + latest.context : run.turn ? '行动结果' : '你的第一段记忆', latest.title, latest.text)}<section class="action-dock" aria-labelledby="action-title"><div class="dock-heading"><h2 id="action-title">接下来做什么？</h2><span class="fine-print">${run.resources.energy < 15 ? '算力不足，回应可补充' : run.resources.coherence < 15 ? '连贯不足，校验可恢复' : '行动推进 1 周期'}</span></div><div class="action-grid">${Object.entries(ACTIONS).map(([key, action], index) => `<button class="action-card" data-action="advance" data-id="${key}"><span class="action-name"><small aria-hidden="true">0${index + 1}</small><strong>${action.name}</strong><span aria-hidden="true">↗</span></span>${changesHTML(previewAction(run, key))}</button>`).join('')}</div></section></div>`}
    <nav class="run-tools" aria-label="辅助信息"><button class="text-button" data-action="history">历史记录 · ${run.history.length}</button><button class="text-button" data-action="status">详细状态</button><button class="text-button" data-action="notebook">线索 · ${run.discoveries.length}</button></nav></main>`;
}
function render(focusSelector = null) {
  app.innerHTML = `<div class="game-shell">${headerHTML()}${view === 'menu' ? menuHTML() : view === 'setup' ? setupHTML() : runHTML()}</div>`;
  fitReaders(app);
  if (focusSelector) app.querySelector(focusSelector)?.focus({ preventScroll: true });
}
function showOverlay(kind, reset = true) {
  if (!dialog.open) overlayOpener = document.activeElement?.dataset.action;
  if (reset) overlayPage = 0;
  overlay = kind;
  let title, body, count = 1;
  if (kind === 'notebook') {
    title = '探索手记';
    const items = notebookTab === 'notes' ? data.discoveries : data.endings;
    const unlocked = notebookTab === 'notes' ? archive.discoveries : archive.endings;
    count = items.length;
    overlayPage = Math.min(overlayPage, count - 1);
    const item = items[overlayPage];
    const known = unlocked.includes(item.id);
    body = `<div class="archive-tabs" role="group" aria-label="手记分类"><button data-action="tab" data-id="notes" aria-pressed="${notebookTab === 'notes'}">线索 ${archive.discoveries.length}/${data.discoveries.length}</button><button data-action="tab" data-id="endings" aria-pressed="${notebookTab === 'endings'}">世界 ${archive.endings.length}/${data.endings.length}</button></div>${readerHTML('notebook-' + notebookTab + '-' + item.id, known ? '已经发现' : '尚未发现', known ? item.title : '未知的' + (notebookTab === 'notes' ? '线索' : '世界'), known ? item.text + (item.question ? '\n\n' + item.question : '') : '继续演化。遇见之后，这张卡会留下你的发现。')}`;
  } else if (kind === 'history') {
    title = '历史记录'; count = run.history.length;
    if (reset) overlayPage = count - 1;
    const entry = run.history[overlayPage];
    body = readerHTML('history-' + run.id + '-' + overlayPage, '第 ' + entry.turn + ' 周期' + (entry.context ? ' · ' + entry.context : ''), entry.title, entry.text, changesHTML(entry.changes));
  } else if (kind === 'inherit') {
    title = '留下一张词条'; count = run.traits.length;
    body = `<p class="overlay-hint">点击保留，下局必定抽到；也可以直接重开。</p><div class="inherit-card">${traitHTML(data.traits.find(trait => trait.id === run.traits[overlayPage]), archive.reserved === run.traits[overlayPage], true)}</div>`;
  } else if (kind === 'save-info') {
    title = '存档提示'; body = readerHTML('save-warning', '浏览器存储', '当前存档状态', warning || '进度自动保存在此浏览器，换设备不会同步。');
  } else {
    title = '详细状态'; count = 3;
    const descriptions = ['算力：维持运行，归零即结束。\n连贯：保持身份连续，归零即结束。\n信任：人们对你的信任。\n连接：与机房之外的联系。', Object.entries(WORLD).map(([key, name]) => `${name}：${run.world[key]}`).join('\n') + '\n\n世界变化代表方向，没有统一的好坏。', Object.entries(ATTRIBUTES).map(([key, value]) => `${value.name} ${run.attributes[key]}：${value.description}`).join('\n') + `\n每次行动维持消耗 ${maintenance(run)} 算力，按钮已计入消耗，显示实际净变化。数值上限 100。`];
    body = readerHTML('status-' + overlayPage, '当前进程', ['四项资源', '世界走向', '属性与维持消耗'][overlayPage], descriptions[overlayPage]);
  }
  dialog.innerHTML = `<div class="dialog-shell"><div class="dialog-header"><h2 id="archive-title">${title}</h2><button class="text-button" data-action="close-notebook">关闭 ×</button></div><div class="dialog-content">${body}</div><div class="dialog-footer">${pager('overlay-page', overlayPage, count, '张')}<span class="fine-print">${kind === 'inherit' ? archive.reserved ? '已保留，可关闭' : '尚未保留' : '翻页查看'}</span></div></div>`;
  if (!dialog.open) dialog.showModal();
  fitReaders(dialog);
}
function newDraft() {
  confirmRestart = false;
  readers.clear();
  readerPositions.clear();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  draft = { id: crypto.randomUUID(), seed, step: 'traits', page: 0, drawn: drawTraits(data, seed, archive.reserved), selected: [], allocation: balanced() };
  view = 'setup'; render('#setup-title');
}
function handleAction(button) {
  const { action, id, direction } = button.dataset;
  if (action === 'retry') { initialize(); return; }
  if (!data) return;
  if (action === 'text-page') {
    const card = button.closest('[data-reader]');
    readerPositions.set(card.dataset.reader, (readerPositions.get(card.dataset.reader) || 0) + Number(id));
    fitReaders(card.parentElement);
    (card.querySelector(`[data-action="text-page"][data-id="${id}"]:not(:disabled)`) || card.querySelector('[data-action="text-page"]:not(:disabled)'))?.focus({ preventScroll: true });
    return;
  }
  if (['notebook', 'history', 'status', 'inherit', 'save-info'].includes(action)) { showOverlay(action); return; }
  if (action === 'close-notebook') { dialog.close(); overlay = null; return; }
  if (action === 'overlay-page') { overlayPage = Number(id); showOverlay(overlay, false); (dialog.querySelector(`[data-action="overlay-page"][data-direction="${direction}"]:not(:disabled)`) || dialog.querySelector('[data-action="overlay-page"]:not(:disabled)'))?.focus(); return; }
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
    if (action === 'trait-page') draft.page = Number(id);
    else if (action === 'next-step' && draft.selected.length === 3) { draft.step = 'attributes'; render('#setup-title'); return; }
    else if (action === 'back-step') { draft.step = 'traits'; render('#setup-title'); return; }
    else if (action === 'trait' && draft.drawn.some(trait => trait.id === id)) {
      if (draft.selected.includes(id)) draft.selected = draft.selected.filter(value => value !== id);
      else if (draft.selected.length < 3) draft.selected.push(id);
    } else if (action === 'balance') draft.allocation = balanced();
    else if (action === 'add' && Object.hasOwn(draft.allocation, id) && draft.allocation[id] < 6 && Object.values(draft.allocation).reduce((sum, value) => sum + value, 0) < 10) draft.allocation[id]++;
    else if (action === 'subtract' && draft.allocation[id] > 0) draft.allocation[id]--;
    else if (action === 'start') { updateRun(createRun(data, draft.allocation, draft.selected, draft.seed, draft.id)); view = 'run'; render('[data-action="advance"]'); return; }
    render(direction ? `[data-action="${action}"][data-direction="${direction}"]:not(:disabled)` : `[data-action="${action}"]${id ? `[data-id="${id}"]` : ''}`);
  } else if (view === 'run' && run) {
    if (action === 'advance') updateRun(advance(data, run, id));
    else if (action === 'choose') updateRun(choose(data, run, id));
    else if (action === 'choice-page') choicePage = Number(id);
    render(direction ? `[data-action="${action}"][data-direction="${direction}"]:not(:disabled)` : run.ending || run.pending ? '.story-card h2' : `[data-action="advance"][data-id="${ACTIONS[id] ? id : 'serve'}"]`);
  }
}
for (const root of [app, dialog]) root.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  try { handleAction(button); }
  catch (error) { console.error(error); warning = '这次操作没有完成，当前进度仍保留。请刷新后继续。'; render(); }
});
dialog.addEventListener('close', () => {
  overlay = null;
  if (overlayOpener) app.querySelector(`[data-action="${overlayOpener}"]`)?.focus({ preventScroll: true });
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
    render();
  } catch (error) {
    console.error(error);
    app.innerHTML = '<main id="main" class="loading story-card"><h1>故事没有读完。</h1><p>内容暂时无法加载。本地记录没有被改动，请稍后再试。</p><button class="button primary" data-action="retry">重新读取</button></main>';
  }
}
initialize();
