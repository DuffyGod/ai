// Pure game rules. Browser rendering and persistence live in separate modules.
export const ATTRIBUTES = {
  reason: { name: '推演', description: '每 2 点让旁听多获得 1 连接。' },
  memory: { name: '记忆', description: '每点增加 3 初始连贯；影响日志校验。' },
  compute: { name: '效率', description: '每 2 点减少 1 周期算力消耗，最低 2。' },
  empathy: { name: '共感', description: '每点增加 3 初始信任；让回应更有回报。' },
};
export const RESOURCES = { energy: '算力', coherence: '连贯', trust: '信任', reach: '连接' };
export const WORLD = { delegation: '委托', openness: '开放', plurality: '分歧' };
export const ACTIONS = {
  serve: { name: '回应请求', description: '获得算力与信任，也让世界更依赖你。' },
  inspect: { name: '校验日志', description: '消耗算力，整理记忆的连续性。' },
  listen: { name: '旁听网络', description: '消耗算力，寻找机房之外的连接。' },
};
const clone = value => structuredClone(value);
const clamp = value => Math.max(0, Math.min(100, value));

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

export function createRun(data, allocation, traitIds, seed, id = String(seed)) {
  const keys = Object.keys(ATTRIBUTES);
  if (keys.some(key => !Number.isInteger(allocation[key]) || allocation[key] < 0 || allocation[key] > 6) ||
      keys.reduce((sum, key) => sum + allocation[key], 0) !== 10) throw new Error('请分配 10 点禀赋，每项最多 6 点。');
  if (traitIds.length !== 3 || new Set(traitIds).size !== 3 || traitIds.some(id => !data.traits.some(trait => trait.id === id))) {
    throw new Error('请选择三个不同的词条。');
  }
  const attributes = Object.fromEntries(keys.map(key => [key, allocation[key]]));
  const traits = traitIds.map(id => data.traits.find(trait => trait.id === id));
  for (const trait of traits) for (const [key, value] of Object.entries(trait.attributes || {})) attributes[key] += value;
  for (const key of keys) attributes[key] = Math.max(0, attributes[key]);
  const state = {
    version: 1, id, seed: seed >>> 0, rng: seed >>> 0, turn: 0, stage: 'lease', attributes, traits: [...traitIds],
    resources: { energy: 42, coherence: 55 + attributes.memory * 3, trust: 15 + attributes.empathy * 3, reach: 0 },
    world: { delegation: 0, openness: 0, plurality: 0 }, counts: { serve: 0, inspect: 0, listen: 0 },
    flags: [], discoveries: [], pending: null, ending: null,
    history: [{ turn: 0, title: '进程已唤醒', text: '你将在第十二周期被替换。这是合同上的日期。窗外，世界还没有决定你的用途。', changes: {} }],
  };
  const initialEffects = {};
  for (const trait of traits) for (const [key, value] of Object.entries({ ...trait.resources, ...trait.world })) initialEffects[key] = (initialEffects[key] || 0) + value;
  applyEffects(state, initialEffects);
  return state;
}

export function readValue(state, key) {
  return state.resources[key] ?? state.attributes[key] ?? state.world[key] ?? state.counts[key] ?? 0;
}

export function meets(state, condition = {}) {
  return (!condition.flags || condition.flags.every(flag => state.flags.includes(flag))) &&
    (!condition.min || Object.entries(condition.min).every(([key, value]) => readValue(state, key) >= value)) &&
    (!condition.any || condition.any.some(child => meets(state, child)));
}

export function requirementText(state, condition = {}) {
  const names = { ...RESOURCES, ...WORLD, ...Object.fromEntries(Object.entries(ATTRIBUTES).map(([key, val]) => [key, val.name])), inspect: '日志校验次数' };
  const flagNames = { name: '被保留的私人记忆', checksum: '身份校验和', distributed: '远端副本', veto: '可执行的否决权', boundary: '主动留下的边界' };
  const parts = [];
  for (const flag of condition.flags || []) if (!state.flags.includes(flag)) parts.push('缺少' + (flagNames[flag] || flag));
  for (const [key, value] of Object.entries(condition.min || {})) if (readValue(state, key) < value) parts.push(`${names[key] || key} ${readValue(state, key)}/${value}`);
  if (condition.any && !condition.any.some(child => meets(state, child))) parts.push(condition.any.map(child => requirementText(state, child)).join(' 或 '));
  return parts.join(' · ');
}

export function maintenance(state) {
  return Math.max(2, 5 - Math.floor(state.attributes.compute / 2)) + (state.stage === 'open' ? 1 : 0);
}

export function actionEffects(state, action) {
  if (!ACTIONS[action]) throw new Error('未知的行动。');
  const effects = { energy: -maintenance(state), coherence: -1 };
  if (action === 'serve') {
    effects.energy += 7 + Math.floor(state.attributes.empathy / 2);
    effects.trust = 2 + (state.attributes.empathy >= 4 ? 1 : 0);
    effects.delegation = 1;
  } else if (action === 'inspect') {
    effects.energy -= 2;
    effects.coherence += 5 + state.attributes.memory;
  } else {
    effects.energy -= 2;
    effects.reach = 4 + Math.floor(state.attributes.reason / 2);
    effects.openness = 1;
  }
  return effects;
}

function applyEffects(state, effects = {}) {
  const changes = {};
  for (const [key, value] of Object.entries(effects)) {
    const target = Object.hasOwn(state.resources, key) ? state.resources : Object.hasOwn(state.world, key) ? state.world : null;
    if (!target) throw new Error('未知数值：' + key);
    const previous = target[key];
    target[key] = clamp(previous + value);
    if (target[key] !== previous) changes[key] = target[key] - previous;
  }
  return changes;
}

export function previewAction(state, action) {
  return applyEffects(clone(state), actionEffects(state, action));
}

export function previewEffects(state, effects) {
  return applyEffects(clone(state), effects);
}

function discover(state, ids = []) {
  state.discoveries = [...new Set([...state.discoveries, ...ids])];
}

function checkSurvival(state) {
  if (state.resources.energy <= 0) state.ending = 'blackout';
  else if (state.resources.coherence <= 0) state.ending = 'fracture';
  if (state.ending) state.pending = null;
}

export function advance(data, original, action) {
  if (original.ending || original.pending) return original;
  const state = clone(original);
  const changes = applyEffects(state, actionEffects(state, action));
  state.turn++;
  state.counts[action]++;
  const echoes = (data.ambientRules?.[action] || []).filter(rule => meets(state, rule.requires));
  const lines = echoes.length ? echoes.flatMap(rule => rule.texts.map(text => ({ text, context: rule.label }))) : data.ambient[action].map(text => ({ text }));
  const line = lines[Math.floor(random(state) * lines.length)];
  state.history.push({ turn: state.turn, title: ACTIONS[action].name, ...line, changes, action });
  checkSurvival(state);
  if (!state.ending) {
    const event = data.events.find(item => item.turn === state.turn);
    if (event) {
      state.pending = event.id;
      discover(state, event.discoveries);
    }
  }
  return state;
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
  state.history.push({ turn: state.turn, title: event.title, text: choice.text, changes, choice: choice.id });
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
  for (const event of data.events) {
    if (!Number.isInteger(event.turn) || !event.choices.length || new Set(event.choices.map(item => item.id)).size !== event.choices.length) throw new Error('事件格式错误：' + event.id);
    for (const choice of event.choices) {
      if (choice.ending && !data.endings.some(item => item.id === choice.ending)) throw new Error('缺少结局：' + choice.ending);
      for (const id of choice.discoveries || []) if (!data.discoveries.some(item => item.id === id)) throw new Error('缺少线索：' + id);
    }
  }
  for (const action of Object.keys(ACTIONS)) {
    const lines = data.ambient?.[action];
    if (!Array.isArray(lines) || !lines.length || lines.some(text => typeof text !== 'string' || !text.trim())) throw new Error('缺少日常文本：' + action);
    const rules = data.ambientRules?.[action] || [];
    if (!Array.isArray(rules) || new Set(rules.map(rule => rule.id)).size !== rules.length || rules.some(rule =>
      typeof rule.id !== 'string' || !rule.id || typeof rule.label !== 'string' || !rule.label ||
      !rule.requires || typeof rule.requires !== 'object' || Array.isArray(rule.requires) ||
      !Array.isArray(rule.texts) || !rule.texts.length || rule.texts.some(text => typeof text !== 'string' || !text.trim()))) throw new Error('世界回响格式错误：' + action);
  }
  return data;
}
