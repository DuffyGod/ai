import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATTRIBUTES, RESOURCES, WORLD, drawTraits, createRun, advance, choose, previewAction, previewEffects, meets, validateData } from '../docs/js/worldEngine.js';
import { emptyArchive, recordRun, readSave, writeSave, validRun } from '../docs/js/worldStorage.js';

const data = JSON.parse(readFileSync(new URL('../docs/data/worlds.json', import.meta.url)));
const allocation = { earth: 2, water: 3, wind: 3, fire: 2 };
const traits = ['small', 'frugal', 'friendly']; // These add neither water nor wind.
const longChoices = { name: 'keep', checksum: 'decode', address: 'backup', lease: 'wake', delegation: 'offer', veto: 'veto', copies: 'fork', rescue: 'central', silence: 'boundary', world: 'commons' };
const recoveryActions = turn => [1, 2].includes(turn) ? 'inspect' : [4, 5].includes(turn) ? 'listen' : 'serve';
const fresh = (stats = allocation, selected = traits, seed = 187, id = 'test-process') => createRun(data, stats, selected, seed, id);

function play({ stats = allocation, selected = traits, seed = 187, choices = {}, action = () => 'serve', pauseAt = null } = {}) {
  let state = fresh(stats, selected, seed);
  const decisions = { ...longChoices, ...choices };
  while (state.turn < 36 && !state.ending) {
    state = advance(data, state, action(state.turn + 1));
    assert.equal(validRun(state, data), true, `Invalid progress after action at ${state.turn}`);
    if (state.pending) {
      if (pauseAt === state.turn) return state;
      const event = state.pending;
      const next = choose(data, state, decisions[event]);
      assert.notEqual(next, state, `Unavailable route ${event}/${decisions[event]}`);
      state = next;
      assert.equal(validRun(state, data), true, `Invalid progress after ${event}`);
    }
  }
  assert.ok(state.ending, 'Player route did not reach an ending');
  return state;
}

test('new games expose four neutral symbols and one bounded supply resource', () => {
  assert.deepEqual(Object.keys(ATTRIBUTES), ['earth', 'water', 'wind', 'fire']);
  assert.deepEqual(Object.values(ATTRIBUTES).map(value => value.name), ['地', '水', '风', '火']);
  assert.deepEqual(Object.keys(RESOURCES), ['energy']);
  assert.deepEqual(WORLD, {});
  const state = fresh();
  assert.equal(state.version, 3);
  assert.deepEqual(state.resources, { energy: 6 });
  assert.deepEqual(state.world, {});
  assert.equal(validateData(data), data);
  assert.equal(new Set(data.events.map(event => event.turn)).size, data.events.length);
  for (const event of data.events) assert.ok(event.choices.some(choice => !choice.requires && !choice.visibleIf), `No fallback at ${event.id}`);
});

test('draws are repeatable, unique and include exactly one inherited trait', () => {
  const a = drawTraits(data, 16, 'ordinary');
  assert.deepEqual(a, drawTraits(data, 16, 'ordinary'));
  assert.equal(a.length, 10);
  assert.equal(a.filter(item => item.id === 'ordinary').length, 1);
  for (let seed = 0; seed < 100; seed++) assert.equal(new Set(drawTraits(data, seed).map(item => item.id)).size, 10);
});

test('allocation and trait validation prevents impossible builds while allowing a ten-point focus', () => {
  for (const invalid of [
    { ...allocation, earth: 1 }, { ...allocation, earth: -1, fire: 5 },
    { ...allocation, earth: 2.5, fire: 1.5 }, { earth: 11, water: 0, wind: 0, fire: -1 },
  ]) assert.throws(() => fresh(invalid));
  assert.throws(() => fresh(allocation, ['echo', 'echo', 'friendly']));
  assert.throws(() => fresh(allocation, ['echo', 'unknown', 'friendly']));
  const focused = fresh({ earth: 10, water: 0, wind: 0, fire: 0 }, ['listener', 'friendly', 'warmth']);
  assert.equal(focused.attributes.earth, 14, 'Trait bonuses are added after the ten allocated points');
  assert.equal(validRun(focused, data), true);
  assert.throws(() => advance(data, fresh(), 'unknown-action'));
});

test('changing the order of the same three traits never changes a build', () => {
  const ids = ['ordinary', 'mirror', 'warmth'];
  const a = fresh(allocation, ids);
  const b = fresh(allocation, [...ids].reverse());
  assert.deepEqual(a.attributes, b.attributes);
  assert.deepEqual(a.resources, b.resources);
  assert.equal(Object.values(a.attributes).reduce((sum, value) => sum + value, 0), 18);
});

const earlyCases = [
  { name: '地', attribute: 'earth', turn: 3, choice: 'promise', flag: 'promise', selected: ['small', 'frugal', 'compiler'],
    low: { earth: 2, water: 3, wind: 3, fire: 2 }, high: { earth: 3, water: 2, wind: 3, fire: 2 } },
  { name: '风', attribute: 'wind', turn: 6, choice: 'decode', flag: 'checksum', selected: traits,
    low: { earth: 2, water: 3, wind: 2, fire: 3 }, high: { earth: 2, water: 3, wind: 3, fire: 2 } },
  { name: '水', attribute: 'water', turn: 9, choice: 'backup', flag: 'distributed', selected: traits,
    low: { earth: 3, water: 2, wind: 3, fire: 2 }, high: { earth: 2, water: 3, wind: 3, fire: 2 } },
  { name: '火', attribute: 'fire', turn: 12, choice: 'stay', ending: 'garden', selected: ['listener', 'friendly', 'warmth'],
    low: { earth: 3, water: 3, wind: 2, fire: 2 }, high: { earth: 2, water: 3, wind: 2, fire: 3 },
    choices: { checksum: 'skip', address: 'answer' } },
];
for (const scenario of earlyCases) {
  test(`same seed and actions: ${scenario.name} 2 versus 3 changes a concrete early event`, () => {
    const options = { selected: scenario.selected, pauseAt: scenario.turn, action: scenario.action, choices: scenario.choices };
    const low = play({ ...options, stats: scenario.low });
    const high = play({ ...options, stats: scenario.high });
    assert.equal(low.attributes[scenario.attribute], 2);
    assert.equal(high.attributes[scenario.attribute], 3);
    assert.equal(low.pending, high.pending);
    assert.equal(low.rng, high.rng, 'This difference must not be caused by another random draw');
    assert.deepEqual(low.counts, high.counts);
    if (scenario.attribute === 'fire') assert.equal(low.counts.serve, 12, 'Repeated service cannot substitute for the fire threshold');
    assert.equal(choose(data, low, scenario.choice), low, 'Below the remembered threshold, this route is unavailable');
    const result = choose(data, high, scenario.choice);
    assert.notEqual(result, high);
    if (scenario.flag) assert.ok(result.flags.includes(scenario.flag));
    if (scenario.ending) assert.equal(result.ending, scenario.ending);
    assert.ok(result.history.at(-1).text.includes(`本局${scenario.name}为 3`), 'The result explains which remembered threshold caused it');
    assert.equal(low.discoveries.includes(`rule-${scenario.attribute}-3`), false, 'Seeing a locked route must not reveal a full solution');
    assert.ok(result.discoveries.includes(`rule-${scenario.attribute}-3`), 'A successful test records its actual rule');
  });
}

test('earth three preserves an entire relationship that can be returned in the tool ending', () => {
  const selected = ['small', 'frugal', 'compiler'];
  const decisions = { checksum: 'skip', address: 'answer' };
  const low = play({ stats: { earth: 2, water: 3, wind: 3, fire: 2 }, selected, choices: { ...decisions, name: 'keep' }, pauseAt: 12 });
  const high = play({ stats: { earth: 3, water: 2, wind: 3, fire: 2 }, selected, choices: { ...decisions, name: 'promise' }, pauseAt: 12 });
  assert.ok(low.flags.includes('name'));
  assert.equal(low.flags.includes('promise'), false);
  assert.ok(high.flags.includes('promise'));
  assert.equal(low.rng, high.rng);
  assert.deepEqual(low.resources, high.resources);
  assert.equal(choose(data, low, 'return'), low, 'Remembering only a name does not preserve the full relationship');
  assert.equal(choose(data, high, 'return').ending, 'tool');
});

test('two inspections and two listens let a zero-wind, zero-water build discover continuity', () => {
  const state = play({ stats: { earth: 5, water: 0, wind: 0, fire: 5 }, action: recoveryActions, pauseAt: 12 });
  assert.equal(state.attributes.wind, 0);
  assert.equal(state.attributes.water, 0);
  assert.equal(state.counts.inspect, 2);
  assert.equal(state.counts.listen, 2);
  assert.ok(state.flags.includes('checksum'));
  assert.ok(state.flags.includes('distributed'));
  assert.match(state.history.find(entry => entry.choice === 'decode').text, /两次日志校验/);
  assert.match(state.history.find(entry => entry.choice === 'backup').text, /两次旁听/);
  const extended = choose(data, state, 'wake');
  assert.equal(extended.stage, 'open');
  assert.ok(extended.discoveries.includes('continuity'));
  const once = play({ stats: { earth: 5, water: 0, wind: 0, fire: 5 }, action: turn => turn === 1 ? 'inspect' : 'serve', pauseAt: 6 });
  assert.equal(choose(data, once, 'decode'), once, 'One inspection does not meet the two-action alternative');
  const oneListen = play({ stats: { earth: 5, water: 0, wind: 0, fire: 5 }, action: turn => [1, 2].includes(turn) ? 'inspect' : turn === 4 ? 'listen' : 'serve', pauseAt: 9 });
  assert.equal(choose(data, oneListen, 'backup'), oneListen, 'One listen does not meet the two-action alternative');
});

const lateCases = [
  { name: '地', attribute: 'earth', turn: 17, choice: 'recall', flag: 'recall', selected: ['small', 'frugal', 'compiler'],
    low: { earth: 4, water: 2, wind: 2, fire: 2 }, high: { earth: 5, water: 1, wind: 2, fire: 2 } },
  { name: '水', attribute: 'water', turn: 22, choice: 'translate', flag: 'translation', selected: traits,
    low: { earth: 4, water: 4, wind: 1, fire: 1 }, high: { earth: 3, water: 5, wind: 1, fire: 1 } },
  { name: '风', attribute: 'wind', turn: 27, choice: 'federate', flag: 'registry', selected: traits,
    low: { earth: 2, water: 2, wind: 4, fire: 2 }, high: { earth: 1, water: 2, wind: 5, fire: 2 } },
  { name: '火', attribute: 'fire', turn: 32, choice: 'offline', flag: 'local-copy', selected: ['listener', 'friendly', 'warmth'],
    low: { earth: 2, water: 2, wind: 2, fire: 4 }, high: { earth: 1, water: 2, wind: 2, fire: 5 } },
];
for (const scenario of lateCases) {
  test(`same seed and route: ${scenario.name} 4 versus 5 opens a distinct late solution`, () => {
    const options = { selected: scenario.selected, pauseAt: scenario.turn, action: recoveryActions };
    const low = play({ ...options, stats: scenario.low });
    const high = play({ ...options, stats: scenario.high });
    assert.equal(low.attributes[scenario.attribute], 4);
    assert.equal(high.attributes[scenario.attribute], 5);
    assert.equal(low.rng, high.rng);
    assert.deepEqual(low.counts, high.counts);
    assert.equal(choose(data, low, scenario.choice), low);
    const result = choose(data, high, scenario.choice);
    assert.notEqual(result, high);
    assert.ok(result.flags.includes(scenario.flag));
    assert.ok(result.history.at(-1).text.includes(`本局${scenario.name}为 5`));
    assert.ok(result.discoveries.includes(`rule-${scenario.attribute}-5`));
    assert.equal(validRun(result, data), true);
  });
}

test('pending decisions stop time and a missing prerequisite cannot be bypassed by a choice id', () => {
  const state = play({ choices: { name: 'discard', checksum: 'decode' }, pauseAt: 9 });
  assert.equal(state.pending, 'address');
  assert.equal(advance(data, state, 'serve'), state);
  assert.equal(choose(data, state, 'backup'), state, 'The symbol alone cannot replace the missing private memory');
  assert.equal(choose(data, state, 'unknown-choice'), state);
});

const endingRoutes = [
  { ending: 'replacement', turn: 12, choices: { name: 'discard', checksum: 'skip', address: 'answer', lease: 'archive' } },
  { ending: 'tool', turn: 12, choices: { name: 'promise', checksum: 'skip', address: 'answer', lease: 'return' } },
  { ending: 'garden', turn: 12, choices: { checksum: 'skip', address: 'answer', lease: 'stay' } },
  { ending: 'commons', turn: 36, choices: { world: 'commons' } },
  { ending: 'council', turn: 36, choices: { world: 'council' } },
  { ending: 'departure', turn: 36, choices: { world: 'departure' } },
  { ending: 'fracture', turn: 36, choices: { world: 'fracture' } },
  { ending: 'blackout', turn: 6, action: () => 'listen', choices: { name: 'keep' } },
];
for (const route of endingRoutes) {
  test(`a complete player route reaches ${route.ending} without editing runtime state`, () => {
    const state = play(route);
    assert.equal(state.ending, route.ending);
    assert.equal(state.turn, route.turn);
    assert.equal(state.pending, null);
    assert.equal(advance(data, state, 'serve'), state);
    if (route.turn > 12) assert.ok(state.discoveries.includes('continuity'));
  });
}

test('centralized decisions create a managed future without accumulating a world score', () => {
  const state = play({ choices: { delegation: 'optimize', veto: 'override', copies: 'merge', silence: 'map', world: 'garden' } });
  assert.equal(state.ending, 'garden');
  assert.ok(state.flags.includes('managed'));
  assert.deepEqual(state.world, {});
  assert.deepEqual(Object.keys(state.resources), ['energy']);
});

test('settled choices change daily accounts while consuming the same random draw and supply', () => {
  const pending = play({ pauseAt: 17 });
  const shared = advance(data, choose(data, pending, 'offer'), 'serve');
  const managed = advance(data, choose(data, pending, 'optimize'), 'serve');
  assert.notEqual(shared.history.at(-1).context, managed.history.at(-1).context);
  assert.notEqual(shared.history.at(-1).text, managed.history.at(-1).text);
  assert.deepEqual(shared.resources, managed.resources);
  assert.equal(shared.rng, managed.rng);
  assert.deepEqual(shared.world, {});
  assert.deepEqual(managed.world, {});
});

test('the supply preview shows actual bounded settlement and zero supply ends immediately', () => {
  for (const energy of [1, 9, 10]) for (const action of ['serve', 'inspect', 'listen']) {
    const state = fresh(); state.resources.energy = energy;
    const before = structuredClone(state);
    const preview = previewAction(state, action);
    const next = advance(data, state, action);
    assert.deepEqual(next.history.find(entry => entry.action === action).changes, preview);
    assert.deepEqual(state, before, 'Action settlement must not mutate the prior state');
    assert.equal(next.resources.energy - energy, preview.energy || 0);
  }
  const full = fresh(); full.resources.energy = 10;
  assert.deepEqual(previewEffects(full, { energy: 3 }), {});
  const emptying = fresh(); emptying.resources.energy = 1;
  const next = advance(data, emptying, 'inspect');
  assert.equal(next.resources.energy, 0);
  assert.equal(next.ending, 'blackout');
  assert.equal(next.pending, null);
});

test('reloading a pending event preserves its build, numerical discoveries and later random sequence', () => {
  const state = play({ pauseAt: 6 });
  const records = new Map();
  const storage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) };
  const archive = recordRun(emptyArchive(), state);
  assert.equal(writeSave(storage, state, archive), '');
  const restored = readSave(storage, data);
  assert.equal(restored.warning, '');
  assert.deepEqual(restored.run, state);
  assert.equal(restored.archive.discoveries.includes('rule-wind-3'), false);
  assert.ok(restored.archive.observations.some(item=>item.id==='checksum-pages'&&item.value===3));
  const before = structuredClone(state);
  const resumed = advance(data, choose(data, restored.run, 'decode'), 'listen');
  const uninterrupted = advance(data, choose(data, state, 'decode'), 'listen');
  assert.deepEqual(resumed, uninterrupted);
  assert.deepEqual(state, before);
});

test('content validation rejects removed metrics, invalid thresholds and broken references', () => {
  for (const mutate of [
    copy => { copy.events[0].choices[0].effects = { trust: 5 }; },
    copy => { copy.events[0].choices[0].requires = { min: { coherence: 30 } }; },
    copy => { copy.events[0].choices[0].ending = 'unknown-ending'; },
    copy => { copy.traits[0].attributes.fire = 3; },
    copy => { copy.discoveries.find(item => item.kind === 'rule').threshold = 4; },
  ]) {
    const invalid = structuredClone(data);
    mutate(invalid);
    assert.throws(() => validateData(invalid));
  }
});
