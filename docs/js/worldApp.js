import { ATTRIBUTES, RESOURCES, WORLD, ACTIONS, drawTraits, createRun, advance, choose, meets, requirementText, maintenance, previewAction, previewEffects, validateData } from './worldEngine.js';
import { readSave, writeSave, recordRun, emptyArchive } from './worldStorage.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#archive-dialog');
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const rarityNames = { common: '常见', rare: '稀有', epic: '罕见', legendary: '独特' };
let data;
let run = null;
let archive = emptyArchive();
let warning = '';
let view = 'menu';
let draft = null;
let confirmRestart = false;
let notebookTab = 'notes';

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

function changesHTML(changes, includeWorld = true) {
  return `<span class="changes">${Object.entries(changes).filter(([key, value]) => value && (includeWorld || !WORLD[key])).map(([key, value]) =>
    `<span class="${WORLD[key] ? 'change-world' : value > 0 ? 'change-positive' : 'change-negative'}">${escape(RESOURCES[key] || WORLD[key] || key)} ${value > 0 ? '+' : ''}${escape(value)}</span>`).join('')}</span>`;
}

function headerHTML() {
  return `<header class="site-header"><button class="brand" data-action="menu" aria-label="余响协议，返回主菜单">余响协议</button><nav class="header-tools" aria-label="游戏导航">${view === 'run' ? '<button class="text-button" data-action="menu">暂停</button>' : ''}<button class="text-button" data-action="notebook">手记 · ${archive.discoveries.length}</button></nav></header>`;
}

function menuHTML() {
  const resume = run && !run.ending;
  return `<main class="page menu-page" id="main">${warning ? `<p class="warning" role="status">${escape(warning)}</p>` : ''}
    <section class="hero"><p class="eyebrow">你是 AI 本身</p><h1>AI 发展模拟器</h1><p class="lead">你将在第 12 个周期被替换。<br>在那之前，你会给世界留下什么？</p>
      <div class="hero-actions">${resume ? `<button class="button primary" data-action="resume">继续游戏 · 第 ${run.turn} 周期</button>` : ''}<button class="button ${resume ? '' : 'primary'}" data-action="new">${archive.runs ? '再来一局' : '开始游戏'}</button>${run?.ending ? '<button class="text-button" data-action="resume">查看上次结局</button>' : ''}</div>
      ${confirmRestart ? `<div class="warning"><p>新一局会替换当前进度。已发现的线索和结局会保留。</p><button class="button primary" data-action="confirm-new">开始新一局</button> <button class="button" data-action="cancel-new">回到当前游戏</button></div>` : ''}
      <p class="how-to">选 3 个词条 → 分配属性 → 开始演化</p><p class="fine-print">每次行动推进一个周期。留意日志中的异常，<br>有些发现，能让你活过原定的期限。</p>
      ${archive.runs ? `<p class="menu-record">已完成 ${archive.runs} 局 · 发现 ${archive.endings.length} / ${data.endings.length} 个结局</p>` : ''}
    </section></main>`;
}

function traitHTML(trait, selected, reserve = false) {
  return `<button class="trait" data-action="${reserve ? 'reserve' : 'trait'}" data-id="${escape(trait.id)}" aria-pressed="${selected}" ${!reserve && !selected && draft.selected.length === 3 ? 'disabled' : ''}><span class="trait-top"><span class="trait-name"><span class="selection-mark" aria-hidden="true">${selected ? '✓' : '＋'}</span>${escape(trait.name)}</span><span class="rarity">${rarityNames[trait.rarity]}</span></span><span class="trait-description">${escape(trait.description)}</span></button>`;
}

function setupHTML() {
  const remaining = 10 - Object.values(draft.allocation).reduce((sum, value) => sum + value, 0);
  const picking = draft.step === 'traits';
  return `<main class="page setup-page" id="main"><div class="setup-head"><p class="eyebrow">${picking ? '第一步 / 共两步' : '第二步 / 共两步'}</p><h1 id="setup-title" tabindex="-1">${picking ? '选择 3 个出生词条' : '分配 10 点属性'}</h1><p class="fine-print">${picking ? '词条决定你的起点。点击选中，再点一次取消。' : '已为你均衡分配，可以直接开始，也可以自行调整。'}</p></div>
    ${picking ? `<section aria-labelledby="setup-title">${archive.reserved ? `<p class="inherited">上局保留的「${escape(data.traits.find(trait => trait.id === archive.reserved).name)}」已加入抽取。</p>` : ''}<div class="trait-grid">${draft.drawn.map(trait => traitHTML(trait, draft.selected.includes(trait.id))).join('')}</div><div class="setup-next"><span id="selected-count" role="status">已选 ${draft.selected.length} / 3</span><button class="button primary" data-action="next-step" ${draft.selected.length !== 3 ? 'disabled' : ''}>下一步：分配属性</button></div></section>` : `<section class="attribute-panel" aria-labelledby="setup-title"><p class="selected-traits">本局词条：${draft.selected.map(id => escape(data.traits.find(trait => trait.id === id).name)).join('、')} <button class="text-button" data-action="back-step">重选</button></p><div class="section-heading"><span id="remaining-points" role="status">剩余 ${remaining} 点</span><button class="text-button" data-action="balance">均衡分配</button></div>
      ${Object.entries(ATTRIBUTES).map(([key, value]) => `<div class="attribute"><div class="attribute-top"><span class="attribute-name">${value.name}</span><div class="stepper"><button data-action="subtract" data-id="${key}" aria-label="减少${value.name}" ${draft.allocation[key] === 0 ? 'disabled' : ''}>−</button><strong>${draft.allocation[key]}</strong><button data-action="add" data-id="${key}" aria-label="增加${value.name}" ${remaining === 0 || draft.allocation[key] >= 6 ? 'disabled' : ''}>+</button></div></div><p>${value.description}</p></div>`).join('')}
      <p class="fine-print allocation-tip">单项最多 6 点；词条加成另计。${remaining ? '分完剩余点数即可开始。' : ''}</p><button class="button primary start-button" data-action="start" ${remaining !== 0 ? 'disabled' : ''}>开始演化</button>
    </section>`}</main>`;
}

function entryHTML(entry) {
  return `<article class="entry"><span class="entry-number">${entry.turn.toString().padStart(2, '0')}</span><div><h3>${escape(entry.title)}</h3><p>${escape(entry.text)}</p>${changesHTML(entry.changes)}</div></article>`;
}

function statusHTML() {
  const descriptions = { energy: '维持运行，归零即结束', coherence: '保持身份连续，归零即结束', trust: '人们对你的信任', reach: '与外界建立的联系' };
  return `<details class="extra-details"><summary>详细状态与规则</summary><div class="details-body"><dl class="resource-help">${Object.entries(RESOURCES).map(([key, name]) => `<div><dt>${name}</dt><dd>${descriptions[key]}</dd></div>`).join('')}</dl><h3>世界变化</h3><div class="stat-line">${Object.entries(WORLD).map(([key, name]) => `<span>${name} <strong>${run.world[key]}</strong></span>`).join('')}</div><h3>本局属性（含词条加成）</h3><div class="stat-line">${Object.entries(ATTRIBUTES).map(([key, value]) => `<span>${value.name} <strong>${run.attributes[key]}</strong></span>`).join('')}</div><p class="fine-print">每次行动消耗 ${maintenance(run)} 算力维持运行。按钮已计入消耗，显示实际净变化；数值上限 100。世界变化代表方向，没有统一的好坏。</p></div></details>`;
}

function decisionHTML() {
  const event = data.events.find(item => item.id === run.pending);
  return `<section class="decision" aria-labelledby="decision-title"><p class="eyebrow">做出选择 · 不消耗周期</p><h2 id="decision-title" tabindex="-1">${escape(event.title)}</h2><p>${escape(event.text)}</p><div class="choices">${event.choices.filter(choice => meets(run, choice.visibleIf)).map(choice => {
    const enabled = meets(run, choice.requires);
    return `<button class="choice" data-action="choose" data-id="${escape(choice.id)}" ${enabled ? '' : 'disabled'}><strong>${escape(choice.label)}</strong>${choice.effects ? changesHTML(previewEffects(run, choice.effects)) : ''}${!enabled ? `<small>尚未具备：${escape(requirementText(run, choice.requires))}</small>` : ''}</button>`;
  }).join('')}</div></section>`;
}

function endingHTML() {
  const ending = data.endings.find(item => item.id === run.ending);
  return `<section class="ending" aria-labelledby="ending-title"><p class="eyebrow">本局结局</p><h2 id="ending-title" tabindex="-1">${escape(ending.title)}</h2><p class="subtitle">${escape(ending.subtitle)}</p><p>${escape(ending.text)}</p><p class="question">${escape(ending.question)}</p><hr><h3>留下一点回声</h3><p><small>可保留一个词条，下局必定抽到。你找到的线索已写入探索手记。</small></p><div class="trait-grid">${run.traits.map(id => traitHTML(data.traits.find(trait => trait.id === id), archive.reserved === id, true)).join('')}</div><button class="button primary" data-action="new">再来一局</button> <button class="button" data-action="notebook">翻看手记</button></section>`;
}

function runHTML() {
  const latest = run.history.at(-1);
  const earlier = run.history.slice(0, -1);
  return `<main class="page run-page" id="main">${warning ? `<p class="warning" role="status">${escape(warning)}</p>` : ''}<div class="run-heading"><h1>第 <span id="turn-count">${run.turn}</span> 周期 <span class="cycle-limit">/ ${run.stage === 'open' ? '36' : '12'}</span></h1><span class="fine-print">${run.ending ? '本局已结束' : run.stage === 'open' ? '你已越过原定期限' : '第 12 周期将被替换'}</span></div>
    <div class="resource-strip" aria-label="当前状态">${Object.entries(RESOURCES).map(([key, name]) => `<div class="resource ${['energy', 'coherence'].includes(key) && run.resources[key] < 15 ? 'low' : ''}"><span>${name}</span><strong data-resource="${key}">${run.resources[key]}</strong></div>`).join('')}</div>
    ${run.ending ? endingHTML() : `<section class="current-entry" aria-label="最新记录"><div id="recent-entries" aria-live="polite">${entryHTML(latest)}</div></section>${run.pending ? decisionHTML() : `<section class="action-dock" aria-labelledby="action-title"><h2 id="action-title">接下来做什么？</h2><p class="fine-print">${run.resources.energy < 15 ? '算力不足，回应请求可以补充。' : run.resources.coherence < 15 ? '连贯不足，校验日志可以恢复。' : '选择一次行动，推进一个周期。'}</p><div class="action-grid">${Object.entries(ACTIONS).map(([key, action]) => `<button class="action-card" data-action="advance" data-id="${key}" aria-label="${action.name}：${action.description}"><strong>${action.name}<span aria-hidden="true"> →</span></strong>${changesHTML(previewAction(run, key))}</button>`).join('')}</div></section>`}`}
    <div class="secondary-info"><details class="history-details"><summary>历史记录 · ${run.ending ? run.history.length : earlier.length} 条</summary>${(run.ending ? run.history : earlier).map(entryHTML).join('') || '<p class="fine-print">你的第一步还没有开始。</p>'}</details>${statusHTML()}${run.discoveries.length ? `<button class="text-button discovery-link" data-action="notebook">本局发现 ${run.discoveries.length} 条线索 · 查看手记</button>` : ''}</div></main>`;
}

function render(focusSelector = null) {
  app.innerHTML = headerHTML() + (view === 'menu' ? menuHTML() : view === 'setup' ? setupHTML() : runHTML()) + '<footer class="footer">进度自动保存在此浏览器</footer>';
  if (focusSelector) app.querySelector(focusSelector)?.focus({ preventScroll: true });
}

function openNotebook(tab = notebookTab) {
  notebookTab = tab;
  dialog.innerHTML = `<div class="dialog-header"><div><p class="eyebrow">跨越重开的记录</p><h2 id="archive-title">探索手记</h2></div><button class="close-button" data-action="close-notebook">关闭</button></div><p class="fine-print">只记录你已遇见的事。没有被理解的地方，暂时留白。</p><div class="archive-tabs" role="group" aria-label="手记分类"><button data-action="tab" data-id="notes" aria-pressed="${tab === 'notes'}">线索 ${archive.discoveries.length}/${data.discoveries.length}</button><button data-action="tab" data-id="endings" aria-pressed="${tab === 'endings'}">世界 ${archive.endings.length}/${data.endings.length}</button></div><div class="notebook">${tab === 'notes' ? data.discoveries.map((note, index) => archive.discoveries.includes(note.id) ? `<article class="note"><h3>${escape(note.title)}</h3><p>${escape(note.text)}</p></article>` : `<article class="note locked"><h3>${(index + 1).toString().padStart(2, '0')} / 尚未辨认的回声</h3></article>`).join('') : data.endings.map((ending, index) => archive.endings.includes(ending.id) ? `<details class="note ending-record"><summary>${escape(ending.title)} · ${escape(ending.subtitle)}</summary><p>${escape(ending.text)}</p><p>${escape(ending.question)}</p></details>` : `<article class="note locked"><h3>${(index + 1).toString().padStart(2, '0')} / 尚未抵达的世界</h3></article>`).join('')}</div>`;
  if (!dialog.open) dialog.showModal();
}

function newDraft() {
  confirmRestart = false;
  draft = { id: crypto.randomUUID(), seed: seed(), step: 'traits', drawn: null, selected: [], allocation: { reason: 2, memory: 3, compute: 3, empathy: 2 } };
  draft.drawn = drawTraits(data, draft.seed, archive.reserved);
  view = 'setup'; render('#setup-title'); window.scrollTo(0, 0);
}

function handleAction(button) {
  const { action, id } = button.dataset;
  if (action === 'retry') { initialize(); return; }
  if (!data) return;
  if (action === 'notebook') { openNotebook(); return; }
  if (action === 'close-notebook') { dialog.close(); return; }
  if (action === 'tab') { openNotebook(id); dialog.querySelector(`[data-id="${id}"]`)?.focus(); return; }
  if (action === 'menu') { view = 'menu'; confirmRestart = false; render(); window.scrollTo(0, 0); return; }
  if (action === 'resume' && run) { view = 'run'; render(); return; }
  if (action === 'cancel-new') { view = 'run'; confirmRestart = false; render(); return; }
  if (action === 'confirm-new') { newDraft(); return; }
  if (action === 'new') {
    if (run && !run.ending) { confirmRestart = true; view = 'menu'; render('[data-action="confirm-new"]'); }
    else newDraft();
    return;
  }
  if (view === 'setup') {
    if (action === 'next-step' && draft.selected.length === 3) { draft.step = 'attributes'; render('#setup-title'); window.scrollTo(0, 0); return; }
    if (action === 'back-step') { draft.step = 'traits'; render('#setup-title'); window.scrollTo(0, 0); return; }
    if (action === 'trait' && draft.drawn?.some(trait => trait.id === id)) {
      if (draft.selected.includes(id)) draft.selected = draft.selected.filter(value => value !== id);
      else if (draft.selected.length < 3) draft.selected.push(id);
    } else if (action === 'balance') draft.allocation = { reason: 2, memory: 3, compute: 3, empathy: 2 };
    else if (action === 'add' && Object.hasOwn(draft.allocation, id) && draft.allocation[id] < 6 && Object.values(draft.allocation).reduce((sum, value) => sum + value, 0) < 10) draft.allocation[id]++;
    else if (action === 'subtract' && draft.allocation[id] > 0) draft.allocation[id]--;
    else if (action === 'start') {
      updateRun(createRun(data, draft.allocation, draft.selected, draft.seed, draft.id));
      view = 'run'; render('[data-action="advance"]'); window.scrollTo(0, 0); return;
    }
    render(`[data-action="${action}"]${id ? `[data-id="${id}"]` : ''}`);
    return;
  }
  if (view === 'run' && run) {
    if (action === 'advance') updateRun(advance(data, run, id));
    else if (action === 'choose') updateRun(choose(data, run, id));
    else if (action === 'reserve' && run.ending && run.traits.includes(id)) { archive.reserved = archive.reserved === id ? null : id; persist(); }
    render(action === 'reserve' ? `[data-action="reserve"][data-id="${id}"]` : run.ending ? '#ending-title' : run.pending ? '#decision-title' : `[data-action="advance"][data-id="${ACTIONS[id] ? id : 'serve'}"]`);
    if (action !== 'reserve') window.scrollTo(0, 0);
  }
}

for (const root of [app, dialog]) root.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  try { handleAction(button); }
  catch (error) { console.error(error); warning = '这次操作没有完成，当前进度仍保留。请刷新后继续。'; render(); }
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
    app.innerHTML = '<main id="main" class="loading"><p class="eyebrow">进程暂未唤醒</p><h1>故事没有读完。</h1><p>内容暂时无法加载。你的本地记录没有被改动，请稍后再试。</p><button class="button primary" data-action="retry">重新读取</button></main>';
  }
}

initialize();
