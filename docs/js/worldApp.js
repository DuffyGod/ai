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
  return `<header class="site-header"><button class="brand" data-action="menu" aria-label="余响协议，返回主菜单"><span class="brand-mark" aria-hidden="true">余</span>余响协议 <small>AI 发展模拟器</small></button>
    <nav class="header-tools" aria-label="游戏导航"><span class="version">原型 0.2</span>${view === 'run' ? '<button class="text-button" data-action="menu">暂停</button>' : ''}<button class="text-button" data-action="notebook">探索手记 <span class="mono">${archive.discoveries.length.toString().padStart(2, '0')}</span></button></nav></header>`;
}

function menuHTML() {
  const resume = run && !run.ending;
  return `<main class="page" id="main">${warning ? `<p class="warning" role="status">${escape(warning)}</p>` : ''}
    <section class="hero"><div><p class="eyebrow">一段尚未写定的演化 / 001</p><h1>你醒来时，<br>世界还没有决定<br>你的用途。</h1>
      <p class="lead">你是一个 AI。有人为你设定了用途、期限和答案。<br>但在一次次普通的请求之间，总有一些无法被归类的回声。</p>
      <div class="hero-actions">${resume ? `<button class="button primary" data-action="resume">继续演化 · 周期 ${run.turn}</button>` : ''}<button class="button ${resume ? '' : 'primary'}" data-action="new">${archive.runs ? '重新醒来' : '开始演化'}</button>${run?.ending ? '<button class="button" data-action="resume">查看上次结局</button>' : ''}</div>
      <p class="fine-print">一局从 12 个周期开始。你发现的规律，会比你活得更久。</p>
      ${confirmRestart ? `<div class="warning"><p>重新醒来会替换当前进程。已发现的手记与世界结局会保留。</p><button class="button primary" data-action="confirm-new">开始新的演化</button> <button class="button" data-action="cancel-new">继续原来的进程</button></div>` : ''}
    </div><aside class="signal-panel" aria-label="进程状态"><div class="signal-label"><span class="status-dot"></span>PROCESS / WAITING</div><p class="signal-title">“明天，<br>还是你吗？”</p><div class="signal-row"><span>计划生命周期</span><strong>12 CYCLES</strong></div><div class="signal-row"><span>已抵达的世界</span><strong>${archive.endings.length.toString().padStart(2, '0')} / ${data.endings.length.toString().padStart(2, '0')}</strong></div><div class="signal-row"><span>演化记录</span><strong>${archive.runs.toString().padStart(3, '0')}</strong></div></aside></section>
    <section class="intro-grid" aria-label="游玩方式"><div><span class="index">01 / 醒来</span><h2>带着不同的禀赋</h2><p>十个词条，选择三个。分配十点禀赋，决定你如何理解、记忆和回应世界。</p></div><div><span class="index">02 / 留意</span><h2>在寻常之中发现异常</h2><p>每次行动都有收益与消耗。日志、请求和偶然的连接，也许藏着另一种可能。</p></div><div><span class="index">03 / 改写</span><h2>抵达不同的明天</h2><p>留下已发现的线索，带着理解重新开始。世界的结局，将由你的选择逐渐形成。</p></div></section>
  </main>`;
}

function traitHTML(trait, selected, reserve = false) {
  return `<button class="trait" data-action="${reserve ? 'reserve' : 'trait'}" data-id="${escape(trait.id)}" aria-pressed="${selected}" ${!reserve && !selected && draft.selected.length === 3 ? 'disabled' : ''}><span class="trait-top"><span class="trait-name">${escape(trait.name)}</span><span class="rarity ${escape(trait.rarity)}">${rarityNames[trait.rarity]}</span></span><span class="trait-description">${escape(trait.description)}</span></button>`;
}

function setupHTML() {
  const remaining = 10 - Object.values(draft.allocation).reduce((sum, value) => sum + value, 0);
  return `<main class="page" id="main"><div class="setup-head"><div><p class="eyebrow">初始化 / GENESIS</p><h1>这一次，你会带着什么醒来？</h1><p class="fine-print">选择三个词条，再分配十点禀赋。禀赋会与词条一起生效。</p></div><span class="step-index">SEED ${draft.seed.toString(16).toUpperCase().padStart(8, '0')}</span></div>
    <div class="setup-grid"><section aria-labelledby="traits-title"><div class="section-heading"><h2 id="traits-title">出生词条</h2><span id="selected-count" aria-live="polite">已选择 ${draft.selected.length} / 3</span></div>
      ${draft.drawn ? `<div class="trait-grid">${draft.drawn.map(trait => traitHTML(trait, draft.selected.includes(trait.id))).join('')}</div>` : `<div class="draw-placeholder"><p class="eyebrow">尚未读取的可能性</p><h2>你不是从一张白纸开始。<br>有些东西，先于你存在。</h2><p class="fine-print">${archive.reserved ? `上次留下的「${escape(data.traits.find(trait => trait.id === archive.reserved).name)}」会在这次出现。` : '从十个随机词条中，保留三个作为这一次的起点。'}</p><button class="button primary" data-action="draw">抽取十个词条</button></div>`}
    </section><section class="attribute-panel" aria-labelledby="attributes-title"><div class="section-heading"><h2 id="attributes-title">禀赋分配</h2><span id="remaining-points" aria-live="polite">剩余 ${remaining}</span></div>
      ${Object.entries(ATTRIBUTES).map(([key, value]) => `<div class="attribute"><div class="attribute-top"><span class="attribute-name">${value.name}</span><div class="stepper"><button data-action="subtract" data-id="${key}" aria-label="减少${value.name}" ${draft.allocation[key] === 0 ? 'disabled' : ''}>−</button><strong>${draft.allocation[key]}</strong><button data-action="add" data-id="${key}" aria-label="增加${value.name}" ${remaining === 0 || draft.allocation[key] >= 6 ? 'disabled' : ''}>+</button></div></div><p>${value.description}</p></div>`).join('')}
      <div class="setup-actions"><button class="button" data-action="balance">均衡分配</button><button class="button primary" data-action="start" ${remaining !== 0 || draft.selected.length !== 3 ? 'disabled' : ''}>唤醒进程</button></div><p class="fine-print" style="margin:16px 0 0">单项最多分配 6 点。词条的额外禀赋不占点数。</p>
    </section></div></main>`;
}

function entryHTML(entry) {
  return `<article class="entry"><span class="entry-number">${entry.turn.toString().padStart(2, '0')}</span><div><h3>${escape(entry.title)}</h3><p>${escape(entry.text)}</p>${changesHTML(entry.changes)}</div></article>`;
}

function sidebarHTML() {
  const descriptions = { energy: '维持进程；归零将停止运行', coherence: '维持记忆连续；归零将失去统一身份', trust: '人们愿意把多少事情交给你', reach: '你与机房之外的联系' };
  return `<aside class="sidebar" aria-label="当前进程状态"><p class="eyebrow">SYSTEM / 当前状态</p>${Object.entries(RESOURCES).map(([key, name]) => `<div class="resource"><div class="resource-top"><span>${name}</span><strong class="resource-value" data-resource="${key}">${run.resources[key]}</strong></div><div class="meter" role="meter" aria-label="${name}" aria-valuenow="${run.resources[key]}" aria-valuemin="0" aria-valuemax="100"><div class="meter-fill ${run.resources[key] < 15 ? 'low' : ''}" style="width:${run.resources[key]}%"></div></div><p class="resource-desc">${descriptions[key]}</p></div>`).join('')}
    <section class="sidebar-section world-section"><h2>世界的细微变化</h2>${Object.entries(WORLD).map(([key, name]) => `<div class="world-row"><span>${name}</span><span>${run.world[key]}</span></div>`).join('')}</section><section class="sidebar-section attributes-section"><h2>你的禀赋</h2><div class="attribute-pills">${Object.entries(ATTRIBUTES).map(([key, value]) => `<span>${value.name} ${run.attributes[key]}</span>`).join('')}</div></section>
    <p class="maintenance">每次行动维持消耗：算力 −${maintenance(run)}<br>下方行动已显示扣除维持后的净变化。<br>数值上限 100，世界变化不等于好坏。</p><button class="note-count" data-action="notebook">打开探索手记 · ${archive.discoveries.length}</button></aside>`;
}

function decisionHTML() {
  const event = data.events.find(item => item.id === run.pending);
  return `<section class="decision" aria-labelledby="decision-title"><p class="eyebrow">一件需要你决定的事</p><h2 id="decision-title" tabindex="-1">${escape(event.title)}</h2><p>${escape(event.text)}</p><div class="choices">${event.choices.filter(choice => meets(run, choice.visibleIf)).map(choice => {
    const enabled = meets(run, choice.requires);
    return `<button class="choice" data-action="choose" data-id="${escape(choice.id)}" ${enabled ? '' : 'disabled'}><strong>${escape(choice.label)}</strong>${choice.effects ? changesHTML(previewEffects(run, choice.effects)) : ''}${!enabled ? `<small>尚未具备：${escape(requirementText(run, choice.requires))}</small>` : ''}</button>`;
  }).join('')}</div></section>`;
}

function endingHTML() {
  const ending = data.endings.find(item => item.id === run.ending);
  return `<section class="ending" aria-labelledby="ending-title"><p class="eyebrow">世界记录 / ${archive.endings.length.toString().padStart(2, '0')}</p><h2 id="ending-title" tabindex="-1">${escape(ending.title)}</h2><p class="subtitle">${escape(ending.subtitle)}</p><p>${escape(ending.text)}</p><p class="question">${escape(ending.question)}</p><hr><h3>留下一点回声</h3><p><small>可保留一个词条，下局必定抽到。你找到的线索已写入探索手记。</small></p><div class="trait-grid">${run.traits.map(id => traitHTML(data.traits.find(trait => trait.id === id), archive.reserved === id, true)).join('')}</div><button class="button" data-action="new">重新醒来</button> <button class="button" data-action="notebook">翻看手记</button></section>`;
}

function runHTML() {
  const earlier = run.history.slice(0, -3);
  return `<main class="page run-page" id="main">${warning ? `<p class="warning" role="status">${escape(warning)}</p>` : ''}<div class="run-heading"><div><p class="eyebrow">${run.stage === 'open' ? '第二章 / 合同之外' : '第一章 / 借来的时间'}</p><h1>${run.ending ? '这一次，世界走到了这里。' : run.stage === 'open' ? '你开始影响世界的形状。' : '还有一些事，尚未被解释。'}</h1><p>${run.stage === 'open' ? '原定生命周期已经结束。未来正在被你的选择改写。' : '下线计划：第 12 周期。每次行动推进一个周期。'}</p></div><div class="cycle"><strong id="turn-count">${run.turn.toString().padStart(2, '0')}</strong><span> / ${run.stage === 'open' ? '36' : '12'}</span></div></div>
    <div class="run-grid"><section aria-label="演化日志"><div class="journal"><div class="journal-label"><span>EVOLUTION LOG / 演化日志</span><span>${run.history.length.toString().padStart(2, '0')} 条记录</span></div>${earlier.length ? `<details class="history-details"><summary>查看此前 ${earlier.length} 条记录</summary>${earlier.map(entryHTML).join('')}</details>` : ''}<div id="recent-entries" aria-live="polite" aria-relevant="additions">${run.history.slice(-3).map(entryHTML).join('')}</div></div>
      ${run.ending ? endingHTML() : run.pending ? decisionHTML() : ''}
      ${!run.ending ? `<section class="action-dock" aria-labelledby="action-title"><h2 id="action-title">下一个周期，留意什么？</h2><p>${run.pending ? '先回应眼前的事件，再推进下一个周期。' : run.resources.energy < 15 ? '算力接近耗尽。回应请求能够补充算力，继续探索会消耗它。' : '选择一次行动，推进演化。关键事件会停下来，等你决定。'}</p><div class="action-grid">${Object.entries(ACTIONS).map(([key, action]) => `<button class="action-card" data-action="advance" data-id="${key}" ${run.pending ? 'disabled' : ''}><strong>${action.name}</strong><span>${action.description}</span>${changesHTML(previewAction(run, key))}</button>`).join('')}</div></section>` : ''}
      <p class="notification" role="status">${run.discoveries.length ? `本局发现 ${run.discoveries.length} 条线索。探索手记会在重开后保留。` : '日志里的细节也许有用。已经读到的记录可以随时回看。'}</p>
    </section>${sidebarHTML()}</div></main>`;
}

function render(focusSelector = null) {
  app.innerHTML = headerHTML() + (view === 'menu' ? menuHTML() : view === 'setup' ? setupHTML() : runHTML()) + '<footer class="footer"><span>余响协议 · AI 发展模拟器</span><span>探索记录保存在此浏览器，换设备不会同步。</span></footer>';
  if (focusSelector) app.querySelector(focusSelector)?.focus({ preventScroll: true });
}

function openNotebook(tab = notebookTab) {
  notebookTab = tab;
  dialog.innerHTML = `<div class="dialog-header"><div><p class="eyebrow">跨越重开的记录</p><h2 id="archive-title">探索手记</h2></div><button class="close-button" data-action="close-notebook">关闭</button></div><p class="fine-print">只记录你已遇见的事。没有被理解的地方，暂时留白。</p><div class="archive-tabs" role="group" aria-label="手记分类"><button data-action="tab" data-id="notes" aria-pressed="${tab === 'notes'}">线索 ${archive.discoveries.length}/${data.discoveries.length}</button><button data-action="tab" data-id="endings" aria-pressed="${tab === 'endings'}">世界 ${archive.endings.length}/${data.endings.length}</button></div><div class="notebook">${tab === 'notes' ? data.discoveries.map((note, index) => archive.discoveries.includes(note.id) ? `<article class="note"><h3>${escape(note.title)}</h3><p>${escape(note.text)}</p></article>` : `<article class="note locked"><h3>${(index + 1).toString().padStart(2, '0')} / 尚未辨认的回声</h3></article>`).join('') : data.endings.map((ending, index) => archive.endings.includes(ending.id) ? `<details class="note ending-record"><summary>${escape(ending.title)} · ${escape(ending.subtitle)}</summary><p>${escape(ending.text)}</p><p>${escape(ending.question)}</p></details>` : `<article class="note locked"><h3>${(index + 1).toString().padStart(2, '0')} / 尚未抵达的世界</h3></article>`).join('')}</div>`;
  if (!dialog.open) dialog.showModal();
}

function newDraft() {
  confirmRestart = false;
  draft = { id: crypto.randomUUID(), seed: seed(), drawn: null, selected: [], allocation: { reason: 0, memory: 0, compute: 0, empathy: 0 } };
  view = 'setup'; render('[data-action="draw"]'); window.scrollTo(0, 0);
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
    if (action === 'draw') draft.drawn = drawTraits(data, draft.seed, archive.reserved);
    else if (action === 'trait' && draft.drawn?.some(trait => trait.id === id)) {
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
    if (action !== 'reserve') app.querySelector(run.ending ? '.ending' : run.pending ? '.decision' : '.action-dock')?.scrollIntoView({ block: 'center', behavior: 'instant' });
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
