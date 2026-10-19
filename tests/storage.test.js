import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun } from '../docs/js/worldEngine.js';
import { createRun as createLegacyRun } from '../docs/legacy-v1/js/worldEngine.js';
import { emptyArchive, readSave, recordRun, writeSave, validRun, STORAGE_KEY } from '../docs/js/worldStorage.js';

const data = JSON.parse(readFileSync(new URL('../docs/data/worlds.json', import.meta.url)));
const legacyData = JSON.parse(readFileSync(new URL('../docs/legacy-v1/data/worlds.json', import.meta.url)));
const legacyKey = 'ai_worlds_v1';
const legacyArchive = () => ({ discoveries: ['name', 'checksum'], endings: ['replacement'], runs: 1, reserved: 'echo', lastCompleted: 'completed-legacy-run' });
const legacyRun = () => createLegacyRun(legacyData, { reason: 2, memory: 3, compute: 3, empathy: 2 }, ['echo', 'friendly', 'frugal'], 187, 'active-legacy-run');
const newRun = () => createRun(data, { earth: 2, water: 3, wind: 3, fire: 2 }, ['echo', 'friendly', 'frugal'], 187, 'new-symbol-run');
function store(entries = []) {
  const records = new Map(entries);
  const writes = [];
  return { records, writes, getItem: key => records.get(key) ?? null, setItem: (key, value) => { writes.push(key); records.set(key, value); } };
}
const legacySave = run => JSON.stringify({ version: 1, run, archive: legacyArchive() });

test('old discoveries migrate while the old process remains available in its own edition', () => {
  const raw = legacySave(legacyRun());
  const storage = store([[legacyKey, raw]]);
  const restored = readSave(storage, data);
  assert.equal(restored.run, null);
  assert.equal(restored.legacyAvailable, true);
  assert.equal(restored.warning, '');
  assert.deepEqual(restored.archive.discoveries, ['name', 'checksum']);
  assert.deepEqual(restored.archive.endings, ['replacement']);
  assert.equal(restored.archive.reserved, 'echo');
  assert.equal(restored.archive.runs, 1);
  assert.equal(storage.records.get(legacyKey), raw);
  assert.deepEqual(storage.writes, [], 'Reading or migrating must never rewrite either edition');
});

test('all eight legacy discoveries and endings remain identifiable after the rules change', () => {
  const archive = { ...legacyArchive(), discoveries: legacyData.discoveries.map(item => item.id), endings: legacyData.endings.map(item => item.id), runs: 8 };
  const restored = readSave(store([[legacyKey, JSON.stringify({ version: 1, run: null, archive })]]), data);
  assert.deepEqual(restored.archive.discoveries, archive.discoveries);
  assert.deepEqual(restored.archive.endings, archive.endings);
  assert.equal(restored.archive.runs, 8);
  assert.equal(restored.archive.discoveries.some(id => data.discoveries.find(item => item.id === id)?.kind === 'rule'), false,
    'Old narrative discoveries must not reveal the new numerical rules');
});

test('a truthy or corrupt old process does not produce a continue-old-game link', () => {
  for (const invalid of [true, { ...legacyRun(), resources: { energy: 42 } }, { ...legacyRun(), pending: 'world' }]) {
    const restored = readSave(store([[legacyKey, legacySave(invalid)]]), data);
    assert.equal(restored.legacyAvailable, false);
    assert.deepEqual(restored.archive.discoveries, ['name', 'checksum'], 'Valid discoveries survive a damaged old process');
  }
  const complete = { ...legacyRun(), ending: 'replacement' };
  assert.equal(readSave(store([[legacyKey, legacySave(complete)]]), data).legacyAvailable, false);
});

test('v3 saves take precedence and never overwrite the bytes of a legacy save', () => {
  const raw = legacySave(legacyRun());
  const storage = store([[legacyKey, raw]]);
  const state = newRun();
  const archive = { ...emptyArchive(), discoveries: ['name'] };
  assert.equal(writeSave(storage, state, archive), '');
  assert.equal(STORAGE_KEY, 'ai_worlds_v3');
  assert.deepEqual(storage.writes, [STORAGE_KEY]);
  assert.equal(storage.records.get(legacyKey), raw);
  const restored = readSave(storage, data);
  assert.deepEqual(restored.run, state);
  assert.deepEqual(restored.archive, archive);
  assert.equal(restored.legacyAvailable, true);
  assert.equal(JSON.parse(storage.records.get(STORAGE_KEY)).version, 3);
});

test('completed process identities are counted once even when revisited after another ending', () => {
  const a = { ...newRun(), id: 'completed-a', ending: 'replacement', discoveries: ['name'] };
  const b = { ...newRun(), id: 'completed-b', ending: 'tool', discoveries: ['checksum'] };
  const initial = emptyArchive();
  const afterA = recordRun(initial, a);
  const afterB = recordRun(afterA, b);
  const revisited = recordRun(afterB, a);
  assert.equal(initial.runs, 0, 'Archiving must not mutate its input');
  assert.equal(revisited.runs, 2);
  assert.deepEqual(revisited.endings, ['replacement', 'tool']);
  assert.deepEqual(revisited.discoveries, ['name', 'checksum']);
  assert.deepEqual(revisited.completedRuns, ['completed-a', 'completed-b']);
  assert.equal(revisited.lastCompleted, 'completed-b');
  const storage = store();
  writeSave(storage, null, revisited);
  assert.equal(recordRun(readSave(storage, data).archive, a).runs, 2);
});

test('damaged v3 progress preserves its independently valid discoveries and inherited selection', () => {
  const archive = { ...emptyArchive(), discoveries: ['name'], endings: ['replacement'], runs: 1, reserved: 'echo', lastCompleted: 'finished', completedRuns: ['finished'] };
  const run = newRun();
  run.pending = 'world';
  const storage = store([[STORAGE_KEY, JSON.stringify({ version: 3, run, archive })]]);
  const restored = readSave(storage, data);
  assert.equal(restored.run, null);
  assert.ok(restored.warning);
  assert.deepEqual(restored.archive, archive);
  assert.deepEqual(storage.writes, []);
});

test('corrupt v3 files recover an existing valid legacy archive without writing', () => {
  for (const raw of ['{', 'null', JSON.stringify({ version: 3, run: null, archive: { ...emptyArchive(), runs: -1 } })]) {
    const storage = store([[legacyKey, legacySave(legacyRun())], [STORAGE_KEY, raw]]);
    const restored = readSave(storage, data);
    assert.equal(restored.run, null);
    assert.equal(restored.legacyAvailable, true);
    assert.deepEqual(restored.archive.discoveries, ['name', 'checksum']);
    assert.ok(restored.warning);
    assert.deepEqual(storage.writes, []);
  }
});

test('the new validator rejects old metric state, forged branches and impossible counters', () => {
  const state = newRun();
  assert.equal(validRun(state, data), true);
  for (const mutate of [
    run => { run.version = 1; },
    run => { run.resources.trust = 50; },
    run => { run.resources.energy = 11; },
    run => { run.world.delegation = 12; },
    run => { run.attributes.wind = 17; },
    run => { run.flags = ['invented-shortcut']; },
    run => { run.counts.inspect = 2; },
    run => { run.stage = 'open'; },
    run => { run.history[0].changes.trust = 5; },
  ]) {
    const invalid = structuredClone(state);
    mutate(invalid);
    assert.equal(validRun(invalid, data), false);
  }
});

test('denied storage still provides a playable empty archive and a clear save warning', () => {
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  const restored = readSave(denied, data);
  assert.equal(restored.run, null);
  assert.equal(restored.legacyAvailable, false);
  assert.deepEqual(restored.archive, emptyArchive());
  assert.ok(restored.warning);
  assert.ok(writeSave(denied, newRun(), emptyArchive()));
});
