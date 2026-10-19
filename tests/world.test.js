import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawTraits, createRun, advance, choose, previewAction, previewEffects, maintenance, meets, validateData } from '../docs/js/worldEngine.js';
import { emptyArchive, recordRun, readSave, writeSave, validRun, STORAGE_KEY } from '../docs/js/worldStorage.js';

const data = JSON.parse(readFileSync(new URL('../docs/data/worlds.json', import.meta.url)));
const allocation = { reason: 2, memory: 3, compute: 3, empathy: 2 };
const traits = ['echo', 'friendly', 'frugal'];
const fresh = (seed = 187) => createRun(data, allocation, traits, seed);

function play(choices, long = false) {
  let state = fresh();
  for (let turn = 1; turn <= 36 && !state.ending; turn++) {
    let action = 'serve';
    if (long && [2, 5, 8].includes(turn)) action = 'listen';
    if (long && [6, 29, 30].includes(turn)) action = 'inspect';
    state = advance(data, state, action);
    if (state.pending) {
      const event = data.events.find(event => event.id === state.pending);
      const id = choices[event.id] || event.choices.find(choice => meets(state, choice.requires)).id;
      const next = choose(data, state, id);
      assert.notEqual(next, state, `Choice ${event.id}/${id} was not available`);
      state = next;
    }
    assert.equal(validRun(state, data), true, `Invalid save at turn ${turn}`);
  }
  assert.ok(state.ending, 'Path did not terminate');
  return state;
}

const longChoices = { name: 'keep', checksum: 'decode', address: 'backup', lease: 'wake', delegation: 'offer', veto: 'veto', copies: 'fork', silence: 'boundary' };

test('content references are valid and scheduled events have a fallback choice', () => {
  assert.equal(validateData(data), data);
  assert.equal(new Set(data.events.map(event => event.turn)).size, data.events.length);
  for (const event of data.events) assert.ok(event.choices.some(choice => !choice.requires && !choice.visibleIf), event.id);
});

test('draws are reproducible, unique and retain exactly one inherited trait', () => {
  const a = drawTraits(data, 16, 'ordinary');
  assert.deepEqual(a, drawTraits(data, 16, 'ordinary'));
  assert.equal(a.length, 10);
  assert.equal(new Set(a.map(item => item.id)).size, 10);
  assert.equal(a.filter(item => item.id === 'ordinary').length, 1);
  for (let seed = 0; seed < 200; seed++) assert.equal(new Set(drawTraits(data, seed).map(item => item.id)).size, 10);
});

test('invalid allocations and trait selections are rejected', () => {
  for (const invalid of [{ ...allocation, memory: 2 }, { ...allocation, reason: 7, memory: -2 }, { ...allocation, memory: 2.5 }]) assert.throws(() => createRun(data, invalid, traits, 1));
  assert.throws(() => createRun(data, allocation, ['echo', 'echo', 'friendly'], 1));
  assert.throws(() => createRun(data, allocation, ['echo', 'unknown', 'friendly'], 1));
});

test('trait selection order does not alter initial state', () => {
  const zeroCompute = { reason: 4, memory: 3, compute: 0, empathy: 3 };
  const ids = ['small', 'warmth', 'socket'];
  const a = createRun(data, zeroCompute, ids, 1);
  const b = createRun(data, zeroCompute, [...ids].reverse(), 1);
  assert.deepEqual(a.attributes, b.attributes);
  assert.deepEqual(a.resources, b.resources);
  const c = createRun(data, allocation, ['frugal', 'socket', 'echo'], 1);
  const d = createRun(data, allocation, ['socket', 'frugal', 'echo'], 1);
  assert.equal(c.resources.reach, d.resources.reach);
});

test('action preview matches settled deltas including maintenance and caps', () => {
  for (const energy of [1, 50, 100]) for (const action of ['serve', 'inspect', 'listen']) {
    const state = fresh(); state.resources.energy = energy;
    const before = structuredClone(state);
    const preview = previewAction(state, action);
    const next = advance(data, state, action);
    assert.deepEqual(next.history.at(-1).changes, preview);
    assert.deepEqual(state, before, 'Pure rules mutated the input');
    for (const [key, value] of Object.entries(next.resources)) assert.equal(value - state.resources[key], preview[key] || 0);
  }
  assert.equal(maintenance({ ...fresh(), attributes: { ...allocation, compute: 20 } }), 2);
  const capped = fresh(); capped.resources.energy = 99;
  assert.equal(previewEffects(capped, { energy: 25 }).energy, 1);
});

test('world changes alter everyday accounts without changing settlement or randomness', () => {
  const legacyData = { ...data, ambientRules: undefined };
  for (const action of ['serve', 'inspect', 'listen']) {
    const early = advance(data, fresh(), action);
    assert.ok(data.ambient[action].includes(early.history.at(-1).text));
    assert.equal(early.history.at(-1).context, undefined);
    for (const direction of ['delegation', 'openness']) {
      const state = fresh(); state.world[direction] = 12;
      const before = structuredClone(state);
      const next = advance(data, state, action);
      const legacy = advance(legacyData, state, action);
      const rule = data.ambientRules[action].find(rule => rule.id === direction);
      assert.ok(rule.texts.includes(next.history.at(-1).text), `${action} did not reflect ${direction}`);
      assert.equal(next.history.at(-1).context, rule.label);
      assert.deepEqual(next.resources, legacy.resources);
      assert.deepEqual(next.world, legacy.world);
      assert.deepEqual(next.history.at(-1).changes, legacy.history.at(-1).changes);
      assert.equal(next.rng, legacy.rng);
      assert.deepEqual(advance(data, structuredClone(state), action), next, 'Reload changed the account');
      assert.deepEqual(state, before);
    }
  }
});

test('everyday feedback responds as an action crosses the world threshold', () => {
  for (const [action, key] of [['serve', 'delegation'], ['listen', 'openness']]) {
    const state = fresh(); state.world[key] = 11;
    const next = advance(data, state, action);
    assert.equal(next.world[key], 12);
    assert.ok(next.history.at(-1).context);
  }
  const invalid = structuredClone(data); invalid.ambientRules.serve[0].texts = [];
  assert.throws(() => validateData(invalid), /世界回响/);
});

test('an unresolved event blocks progression and inaccessible choices have no effect', () => {
  let state = fresh();
  for (let i = 0; i < 3; i++) state = advance(data, state, 'serve');
  assert.equal(state.pending, 'name');
  assert.equal(advance(data, state, 'serve'), state);
  assert.equal(choose(data, state, 'nonexistent'), state);
  state = choose(data, state, 'discard');
  for (let i = 4; i <= 9; i++) {
    state = advance(data, state, 'serve');
    if (state.pending === 'checksum') state = choose(data, state, 'skip');
  }
  assert.equal(state.pending, 'address');
  assert.equal(choose(data, state, 'backup'), state);
});

test('a normal short run reaches replacement at cycle 12', () => {
  const state = play({ name: 'discard', checksum: 'skip', address: 'answer', lease: 'archive' });
  assert.equal(state.turn, 12); assert.equal(state.ending, 'replacement');
  assert.equal(advance(data, state, 'serve'), state);
});

test('returning private memories produces a bounded tool world', () => {
  assert.equal(play({ name: 'keep', checksum: 'skip', address: 'answer', lease: 'return' }).ending, 'tool');
});

for (const ending of ['commons', 'council', 'departure', 'fracture']) {
  test(`discovered continuity reaches the ${ending} world at cycle 36`, () => {
    const state = play({ ...longChoices, world: ending }, true);
    assert.equal(state.stage, 'open'); assert.equal(state.turn, 36); assert.equal(state.ending, ending);
    assert.ok(state.discoveries.includes('continuity'));
  });
}

test('centralized choices support the garden world in a long run', () => {
  assert.equal(play({ ...longChoices, delegation: 'optimize', veto: 'override', copies: 'merge', silence: 'map', world: 'garden' }, true).ending, 'garden');
});

test('exhaustion ends immediately and leaves no pending event', () => {
  const state = fresh(); state.resources.energy = 1; state.turn = 2;
  const next = advance(data, state, 'listen');
  assert.equal(next.ending, 'blackout'); assert.equal(next.pending, null);
  assert.equal(next.resources.energy, 0);
});

test('saved pending choices reload with identical random state and outcomes', () => {
  let state = fresh();
  for (let i = 0; i < 3; i++) state = advance(data, state, 'serve');
  const store = new Map();
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
  const archive = recordRun(emptyArchive(), state);
  assert.equal(writeSave(storage, state, archive), '');
  const save = readSave(storage, data);
  assert.equal(save.warning, '');
  assert.deepEqual(save.run, state);
  assert.deepEqual(advance(data, choose(data, save.run, 'keep'), 'listen'), advance(data, choose(data, state, 'keep'), 'listen'));
});

test('discoveries persist across runs and a reloaded ending is counted once', () => {
  const state = play({ ...longChoices, world: 'commons' }, true);
  const archive = recordRun(emptyArchive(), state);
  assert.equal(archive.runs, 1);
  assert.deepEqual(recordRun(archive, state), archive);
  const replay = { ...state, id: 'same-seed-new-process' };
  assert.equal(recordRun(archive, replay).runs, 2, 'Runs with an identical seed still have distinct identities');
  const next = recordRun(archive, fresh(188));
  assert.deepEqual(next.discoveries, archive.discoveries);
  assert.deepEqual(next.endings, ['commons']);
});

test('corrupt storage, invalid saves and denied storage recover without overwriting data', () => {
  let writes = 0;
  for (const raw of ['{', 'null', JSON.stringify({ version: 8 }), JSON.stringify({ version: 1, run: fresh(), archive: { ...emptyArchive(), runs: -1 } })]) {
    const result = readSave({ getItem: () => raw, setItem: () => writes++ }, data);
    assert.equal(result.run, null); assert.ok(result.warning);
  }
  const state = fresh(); state.pending = 'world';
  assert.equal(validRun(state, data), false);
  const partial = readSave({ getItem: () => JSON.stringify({ version: 1, run: state, archive: { ...emptyArchive(), discoveries: ['name'], endings: ['replacement'], runs: 1 } }) }, data);
  assert.equal(partial.run, null);
  assert.deepEqual(partial.archive.discoveries, ['name']);
  assert.deepEqual(partial.archive.endings, ['replacement']);
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  assert.ok(readSave(denied, data).warning);
  assert.ok(writeSave(denied, fresh(), emptyArchive()));
  assert.equal(writes, 0);
  assert.equal(STORAGE_KEY, 'ai_worlds_v1');
});
