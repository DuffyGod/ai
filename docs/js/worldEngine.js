// New runs use observation-led discovery. Earlier runs keep their original rules in legacy-v1/v2.
export const RULES = { points: 10, attributeMax: 10, earlyThreshold: 3, lateThreshold: 5, energyStart: 6, energyMax: 10 };
export const ATTRIBUTES = {
  earth: { name: '地', description: '一种初始符号；已遇见的规律会记入手记。' },
  water: { name: '水', description: '一种初始符号；已遇见的规律会记入手记。' },
  wind: { name: '风', description: '一种初始符号；已遇见的规律会记入手记。' },
  fire: { name: '火', description: '一种初始符号；已遇见的规律会记入手记。' },
};
export const RESOURCES = { energy: '供能' };
export const WORLD = {};
export const ACTIONS = {
  serve: { name: '回应请求', description: '获得 2 供能，继续与人们往来。' },
  inspect: { name: '校验日志', description: '消耗 1 供能，留下校验过的记录。' },
  listen: { name: '旁听网络', description: '消耗 1 供能，寻找机房之外的地址。' },
};
const clone = value => structuredClone(value);
const clampEnergy = value => Math.max(0, Math.min(RULES.energyMax, value));

function random(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

export function drawTraits(data, seed, reserved = null) {
  const state = { rng: seed >>> 0 };
  const drawn = data.traits.filter(trait => trait.id === reserved);
  const weights = { common: 8, rare: 4, epic: 2, legendary: 1 };
  while (drawn.length < Math.min(10, data.traits.length)) {
    const available = data.traits.filter(trait => !drawn.some(other => other.id === trait.id));
    let ticket = random(state) * available.reduce((sum, trait) => sum + weights[trait.rarity], 0);
    const next = available.find(trait => (ticket -= weights[trait.rarity]) < 0) || available.at(-1);
    drawn.push(next);
  }
  return drawn;
}

export function createRun(data, allocation, traitIds, seed, id = String(seed), pool = null) {
  const keys = Object.keys(ATTRIBUTES);
  if (keys.some(key => !Number.isInteger(allocation[key]) || allocation[key] < 0 || allocation[key] > RULES.attributeMax) ||
      keys.reduce((sum, key) => sum + allocation[key], 0) !== RULES.points) throw new Error('请分配 10 点，每项可以分配 0 至 10 点。');
  if (traitIds.length !== 3 || new Set(traitIds).size !== 3 || traitIds.some(traitId => !data.traits.some(trait => trait.id === traitId))) {
    throw new Error('请选择三个不同的词条。');
  }
  const attributes = Object.fromEntries(keys.map(key => [key, allocation[key]]));
  for (const traitId of traitIds) {
    const trait = data.traits.find(item => item.id === traitId);
    for (const [key, value] of Object.entries(trait.attributes || {})) attributes[key] += value;
  }
  const drawn = pool || [...new Set([...traitIds, ...drawTraits(data, seed).map(trait => trait.id)])].slice(0, 10);
  if (drawn.length !== 10 || new Set(drawn).size !== 10 || traitIds.some(traitId => !drawn.includes(traitId)) || drawn.some(traitId => !data.traits.some(trait => trait.id === traitId))) throw new Error('出生词条池不完整。');
  return {
    version: 3, id, allocation: { ...allocation }, pool: [...drawn], seed: seed >>> 0, rng: seed >>> 0, turn: 0, stage: 'lease', attributes, traits: [...traitIds],
    resources: { energy: RULES.energyStart }, world: {}, counts: { serve: 0, inspect: 0, listen: 0 },
    flags: [...new Set(traitIds.flatMap(traitId => data.traits.find(trait => trait.id === traitId).flags || []))], discoveries: [], observations: [], pending: null, ending: null,
    history: [{ turn: 0, title: '进程已唤醒', text: '你将在第十二周期被替换。这是合同上的日期。窗外，世界还没有决定你的用途。', changes: {} }],
  };
}

export function readValue(state, key) {
  return state.resources[key] ?? state.attributes[key] ?? state.counts[key] ?? 0;
}

export function meets(state, condition = {}) {
  return (!condition.flags || condition.flags.every(flag => state.flags.includes(flag))) &&
    (!condition.min || Object.entries(condition.min).every(([key, value]) => readValue(state, key) >= value)) &&
    (!condition.any || condition.any.some(child => meets(state, child)));
}

export function requirementText(state, condition = {}) {
  const names = { ...RESOURCES, ...Object.fromEntries(Object.entries(ATTRIBUTES).map(([key, value]) => [key, value.name])), inspect: '校验', listen: '旁听', serve: '回应' };
  const flagNames = { name: '私人记忆', checksum: '身份校验和', distributed: '远端副本', shared: '共享修改方法',
    veto: '可执行的否决权', fork: '保留独立副本', boundary: '主动留下的边界', managed: '集中托管的约定',
    promise: '明日的约定', recall: '可撤回的约定', translation: '共同修订的规则', registry: '副本互认名单', 'local-copy': '离线工具',
    'known-port': '回拨地址', unheard: '名单外的联系', difference: '副本的地方记录' };
  const parts = [];
  for (const flag of condition.flags || []) if (!state.flags.includes(flag)) parts.push('需要' + (flagNames[flag] || flag));
  for (const [key, value] of Object.entries(condition.min || {})) if (readValue(state, key) < value) {
    parts.push(`${names[key] || key} ${readValue(state, key)}/${value}${Object.hasOwn(ACTIONS, key) ? ' 次' : ''}`);
  }
  if (condition.any && !condition.any.some(child => meets(state, child))) parts.push(condition.any.map(child => requirementText(state, child)).filter(Boolean).join(' 或 '));
  return parts.join(' · ');
}

export function learnedRequirementText(state, choice, knownDiscoveries = []) {
  const containsNumbers = condition => Boolean(condition?.min && Object.keys(condition.min).length) ||
    (condition?.any || []).some(containsNumbers);
  if (!containsNumbers(choice.requires)) return requirementText(state, choice.requires);
  const routes = (choice.routes || []).filter(route => (route.discoveries || []).some(id => knownDiscoveries.includes(id)));
  const parts = [requirementText(state, { flags: choice.requires?.flags }),
    ...routes.map(route => requirementText(state, route.requires))];
  return [...new Set(parts.filter(Boolean))].join('\n');
}

// The old API remains callable; new games have no automatic upkeep.
export function maintenance() { return 0; }

export function actionEffects(state, action) {
  if (!ACTIONS[action]) throw new Error('未知的行动。');
  return { energy: action === 'serve' ? 2 : -1 };
}

function applyEffects(state, effects = {}) {
  const changes = {};
  for (const [key, value] of Object.entries(effects)) {
    if (key !== 'energy') throw new Error('未知数值：' + key);
    const previous = state.resources.energy;
    state.resources.energy = clampEnergy(previous + value);
    if (state.resources.energy !== previous) changes.energy = state.resources.energy - previous;
  }
  return changes;
}

export function previewAction(state, action) { return applyEffects(clone(state), actionEffects(state, action)); }
export function previewEffects(state, effects) { return applyEffects(clone(state), effects); }

function discover(state, ids = []) { state.discoveries = [...new Set([...state.discoveries, ...ids])]; }

function checkSurvival(state) {
  if (state.resources.energy <= 0) {
    state.ending = 'blackout';
    state.pending = null;
  }
}

export function observationKey(reading) {
  return `${reading.id}:${reading.key}:${reading.attribute || reading.counter || '-'}:${reading.value ?? '-'}`;
}

// A lead is offered only after this run has supplied its evidence. Reading an
// archive never creates an investigation opportunity in the current world.
export function investigationLeads(data, state) {
  return (data.leads || []).filter(lead => {
    const readings = state.observations.filter(item => item.id === lead.subject);
    return readings.some(item => lead.openKeys.includes(item.key)) &&
      !readings.some(item => lead.resolvedKeys.includes(item.key)) && state.turn < lead.until;
  });
}

export function eventText(event, state) {
  const context = event.contexts?.find(item => meets(state, item.requires));
  return event.text + (context ? '\n\n' + context.text : '');
}

function observe(data, state, action) {
  const fresh = [];
  for (const subject of data.observations || []) {
    const triggers = subject.triggers.filter(item =>
      (item.turn === undefined || item.turn === state.turn) &&
      (!item.action || item.action === action) &&
      (item.from === undefined || state.turn >= item.from) &&
      (item.until === undefined || state.turn <= item.until));
    if (!triggers.length) continue;
    state.flags = [...new Set([...state.flags, ...triggers.flatMap(trigger => trigger.flags || [])])];
    const variant = subject.variants.find(item => meets(state, item.requires));
    if (variant.counter && state.counts[variant.counter] > 2) continue;
    const reading = { id: subject.id, key: variant.key, turn: state.turn, runId: state.id, outcome: variant.outcome, text: variant.text };
    if (variant.attribute) { reading.attribute = variant.attribute; reading.value = state.attributes[variant.attribute]; }
    if (variant.counter) { reading.counter = variant.counter; reading.value = state.counts[variant.counter]; }
    reading.signature = observationKey(reading);
    if (state.observations.some(item => item.signature === reading.signature)) continue;
    state.observations.push(reading);
    fresh.push({ ...reading, title: subject.title });
  }
  return fresh;
}

export function advance(data, original, action) {
  if (original.ending || original.pending) return original;
  const state = clone(original);
  const changes = applyEffects(state, actionEffects(state, action));
  state.turn++;
  state.counts[action]++;
  checkSurvival(state);
  const observed = state.ending ? [] : observe(data, state, action);
  const matched = (data.ambientRules?.[action] || []).filter(rule => meets(state, rule.requires));
  const priority = Math.max(0, ...matched.map(rule => rule.priority || 0));
  const echoes = matched.filter(rule => (rule.priority || 0) === priority);
  const lines = echoes.length ? echoes.flatMap(rule => rule.texts.map(text => ({ text, context: rule.label }))) : data.ambient[action].map(text => ({ text }));
  const line = lines[Math.floor(random(state) * lines.length)];
  state.history.push({ turn: state.turn, title: ACTIONS[action].name, ...line, changes, action });
  for (const reading of observed) state.history.push({ turn: state.turn, title: reading.title, text: reading.text, changes: {}, observation: reading.id, signature: reading.signature });
  if (!state.ending) {
    const event = data.events.find(item => item.turn === state.turn);
    if (event) { state.pending = event.id; discover(state, event.discoveries); }
  }
  return state;
}

// Routine requests can pass quickly. Every decision and every unseen reading stops.
export function advanceUntilChange(data, original, knownReadings = []) {
  if (original.ending || original.pending) return original;
  const known = new Set(knownReadings.map(item => typeof item === 'string' ? item : observationKey(item)));
  let state = original;
  for (let step = 0; step < 36 && !state.pending && !state.ending; step++) {
    const previous = state.observations.length;
    const previousLeads = new Set(investigationLeads(data, state).map(item => item.id));
    state = advance(data, state, 'serve');
    if (state.observations.slice(previous).some(reading => !known.has(observationKey(reading)))) break;
    if (investigationLeads(data, state).some(item => !previousLeads.has(item.id))) break;
  }
  return state;
}

export function endingConsequences(data, state) {
  return (data.endingEchoes || []).filter(item => item.endings.includes(state.ending) && meets(state, item.requires) && (!item.unless || !meets(state, item.unless))).map(item => item.text);
}

export function choose(data, original, choiceId) {
  if (original.ending || !original.pending) return original;
  const event = data.events.find(item => item.id === original.pending);
  const choice = event?.choices.find(item => item.id === choiceId);
  if (!choice || !meets(original, choice.requires) || !meets(original, choice.visibleIf)) return original;
  const state = clone(original);
  const changes = applyEffects(state, choice.effects);
  state.flags = [...new Set([...state.flags, ...(choice.flags || [])])];
  discover(state, choice.discoveries);
  const route = choice.routes?.find(item => meets(original, item.requires));
  const verified = (route?.discoveries || []).filter(id => {
    const item = data.discoveries.find(entry => entry.id === id);
    return item.kind !== 'rule' || original.attributes[item.attribute] === item.threshold;
  });
  discover(state, verified);
  let proof = route?.text || '';
  for (const [key, value] of Object.entries(route?.requires?.min || {})) {
    if (ATTRIBUTES[key]) proof = proof.replace(`${ATTRIBUTES[key].name}达到 ${value}`, `本局${ATTRIBUTES[key].name}为 ${original.attributes[key]}`);
  }
  const resultText = eventText(choice, state);
  const text = proof ? `${proof} ${resultText}` : resultText;
  state.history.push({ turn: state.turn, title: event.title, text, changes, choice: choice.id });
  state.pending = null;
  if (choice.extend) state.stage = 'open';
  if (choice.ending) state.ending = choice.ending;
  checkSurvival(state);
  return state;
}

export function validateData(data) {
  for (const key of ['traits', 'events', 'endings', 'discoveries']) {
    if (!Array.isArray(data[key]) || new Set(data[key].map(item => item.id)).size !== data[key].length) throw new Error('内容数据格式错误：' + key);
  }
  const valueKeys = new Set([...Object.keys(ATTRIBUTES), 'energy', ...Object.keys(ACTIONS)]);
  const knownFlags = new Set(Object.keys(data.milestones || {}));
  const validateCondition = condition => {
    if (!condition) return;
    if (typeof condition !== 'object' || Array.isArray(condition) ||
        (condition.flags && (!Array.isArray(condition.flags) || condition.flags.some(flag => !knownFlags.has(flag)))) ||
        (condition.min && Object.entries(condition.min).some(([key, value]) => !valueKeys.has(key) || !Number.isInteger(value) || value < 0)) ||
        (condition.any && (!Array.isArray(condition.any) || !condition.any.length))) throw new Error('条件格式错误');
    for (const child of condition.any || []) validateCondition(child);
  };
  for (const trait of data.traits) {
    if (typeof trait.description !== 'string' || !trait.description.trim() ||
        Object.entries(trait.attributes || {}).some(([key, value]) => !Object.hasOwn(ATTRIBUTES, key) || !Number.isInteger(value) || value < 1 || value > 2) ||
        Object.keys(trait.resources || {}).length || Object.keys(trait.world || {}).length || (trait.flags || []).some(flag => !knownFlags.has(flag))) throw new Error('词条格式错误：' + trait.id);
  }
  for (const discovery of data.discoveries) if (discovery.kind === 'rule' &&
      (!Object.hasOwn(ATTRIBUTES, discovery.attribute) || ![RULES.earlyThreshold, RULES.lateThreshold].includes(discovery.threshold))) throw new Error('规律格式错误：' + discovery.id);
  for (const event of data.events) {
    if (!Number.isInteger(event.turn) || !event.choices.length || new Set(event.choices.map(item => item.id)).size !== event.choices.length) throw new Error('事件格式错误：' + event.id);
    for (const id of event.discoveries || []) if (!data.discoveries.some(item => item.id === id)) throw new Error('缺少线索：' + id);
    for (const context of event.contexts || []) {
      validateCondition(context.requires);
      if (!context.text || !context.requires) throw new Error('事件上下文格式错误：' + event.id);
    }
    for (const choice of event.choices) {
      if (choice.lead && !(data.leads || []).some(lead => lead.id === choice.lead)) throw new Error('缺少调查入口：' + choice.id);
      validateCondition(choice.requires);
      validateCondition(choice.visibleIf);
      for (const context of choice.contexts || []) {
        validateCondition(context.requires);
        if (!context.text || !context.requires) throw new Error('选择上下文格式错误：' + choice.id);
      }
      for (const route of choice.routes || []) {
        validateCondition(route.requires);
        for (const id of route.discoveries || []) if (!data.discoveries.some(item => item.id === id)) throw new Error('缺少线索：' + id);
        if (typeof route.text !== 'string' || !route.text.trim()) throw new Error('因果记录格式错误：' + choice.id);
      }
      if (Object.entries(choice.effects || {}).some(([key, value]) => key !== 'energy' || !Number.isInteger(value))) throw new Error('选项数值格式错误：' + choice.id);
      if ((choice.flags || []).some(flag => !knownFlags.has(flag))) throw new Error('未知经历：' + choice.id);
      if (choice.ending && !data.endings.some(item => item.id === choice.ending)) throw new Error('缺少结局：' + choice.ending);
      for (const id of choice.discoveries || []) if (!data.discoveries.some(item => item.id === id)) throw new Error('缺少线索：' + id);
    }
  }
  for (const action of Object.keys(ACTIONS)) {
    const lines = data.ambient?.[action];
    if (!Array.isArray(lines) || !lines.length || lines.some(text => typeof text !== 'string' || !text.trim())) throw new Error('缺少日常文本：' + action);
    const rules = data.ambientRules?.[action] || [];
    if (!Array.isArray(rules) || new Set(rules.map(rule => rule.id)).size !== rules.length) throw new Error('世界回响格式错误：' + action);
    for (const rule of rules) {
      validateCondition(rule.requires);
      if (!rule.id || !rule.label || !rule.requires || !Array.isArray(rule.texts) || !rule.texts.length ||
          rule.texts.some(text => typeof text !== 'string' || !text.trim()) ||
          (rule.priority !== undefined && (!Number.isInteger(rule.priority) || rule.priority < 0))) throw new Error('世界回响格式错误：' + action);
    }
  }
  if (!Array.isArray(data.observations) || new Set(data.observations.map(item => item.id)).size !== data.observations.length) throw new Error('观察格式错误');
  for (const subject of data.observations) {
    if (!subject.triggers?.length || !subject.variants?.length || subject.variants.at(-1).requires) throw new Error('观察缺少后备结果：' + subject.id);
    if (new Set(subject.variants.map(item => item.key)).size !== subject.variants.length) throw new Error('重复观察结果');
    for (const trigger of subject.triggers) {
      if ((trigger.action && !ACTIONS[trigger.action]) || (trigger.flags || []).some(flag => !knownFlags.has(flag))) throw new Error('观察触发错误');
    }
    for (const item of subject.variants) {
      validateCondition(item.requires);
      if (!item.key || !item.text || !item.outcome || (item.attribute && !ATTRIBUTES[item.attribute]) || (item.counter && !ACTIONS[item.counter])) throw new Error('观察结果错误');
    }
  }
  for (const item of data.endingEchoes || []) {
    validateCondition(item.requires); validateCondition(item.unless);
    if (!item.endings.length || item.endings.some(id => !data.endings.some(ending => ending.id === id)) || !item.text) throw new Error('结局后果格式错误');
  }
  if (new Set((data.leads || []).map(item => item.id)).size !== (data.leads || []).length) throw new Error('重复调查入口');
  for (const lead of data.leads || []) {
    const subject = data.observations.find(item => item.id === lead.subject);
    if (!subject || !ACTIONS[lead.action] || !lead.title || !lead.text || !lead.closedText ||
        !Number.isInteger(lead.until) || lead.until < 1 || lead.until > 36 ||
        !lead.openKeys?.length || !lead.resolvedKeys?.length ||
        [...lead.openKeys, ...lead.resolvedKeys].some(key => !subject.variants.some(item => item.key === key))) throw new Error('调查入口格式错误：' + lead.id);
  }
  return data;
}
