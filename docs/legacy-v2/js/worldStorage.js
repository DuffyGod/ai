import { ATTRIBUTES, RESOURCES } from './worldEngine.js';
import { readSave as readLegacySave } from '../../legacy-v1/js/worldStorage.js';

export const STORAGE_KEY = 'ai_worlds_v2';
export const emptyArchive = () => ({ discoveries: [], endings: [], runs: 0, reserved: null, lastCompleted: null, completedRuns: [] });

const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 100;
const unique = values => [...new Set(values)];
const numericObject = (value, keys, max) => value && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= max);
const knownIds = (value, records) => Array.isArray(value) && value.length <= records.length &&
  value.every(id => records.some(record => record.id === id));

function archiveFrom(value, data) {
  if (!value || !knownIds(value.discoveries, data.discoveries) || !knownIds(value.endings, data.endings) ||
      !Number.isSafeInteger(value.runs) || value.runs < 0 ||
      (value.reserved !== null && !data.traits.some(trait => trait.id === value.reserved)) ||
      (value.lastCompleted !== null && !validId(value.lastCompleted)) ||
      (value.completedRuns !== undefined && (!Array.isArray(value.completedRuns) || value.completedRuns.length > 1000 || !value.completedRuns.every(validId)))) return null;
  const completedRuns = unique([...(value.completedRuns || []), ...(value.lastCompleted ? [value.lastCompleted] : [])]).slice(-1000);
  if (completedRuns.length > value.runs) return null;
  return { discoveries: unique(value.discoveries), endings: unique(value.endings), runs: value.runs,
    reserved: value.reserved, lastCompleted: value.lastCompleted, completedRuns };
}

export function recordRun(archive, run) {
  const next = structuredClone(archive);
  next.discoveries = unique([...next.discoveries, ...run.discoveries]);
  next.completedRuns = unique([...(next.completedRuns || []), ...(next.lastCompleted ? [next.lastCompleted] : [])]);
  if (run.ending) {
    next.endings = unique([...next.endings, run.ending]);
    if (!next.completedRuns.includes(run.id)) {
      next.runs++;
      next.completedRuns.push(run.id);
      next.lastCompleted = run.id;
    }
  }
  next.completedRuns = next.completedRuns.slice(-1000);
  return next;
}

function knownFlags(data) {
  const flags = new Set();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'flags' && Array.isArray(item)) for (const flag of item) flags.add(flag);
      else visit(item);
    }
  }
  visit(data);
  return flags;
}

export function validRun(run, data) {
  if (!run || run.version !== 2 || !validId(run.id) || !Number.isInteger(run.seed) || run.seed < 0 || run.seed > 0xffffffff ||
      !Number.isInteger(run.rng) || run.rng < 0 || run.rng > 0xffffffff ||
      !Number.isInteger(run.turn) || run.turn < 0 || run.turn > 36 || !['lease', 'open'].includes(run.stage)) return false;
  if (!numericObject(run.attributes, Object.keys(ATTRIBUTES), 16) || !numericObject(run.resources, Object.keys(RESOURCES), 10) ||
      !numericObject(run.world, [], 0) || !numericObject(run.counts, ['serve', 'inspect', 'listen'], 36) ||
      Object.values(run.counts).reduce((sum, value) => sum + value, 0) !== run.turn) return false;
  const flags = knownFlags(data);
  if (!knownIds(run.traits, data.traits) || run.traits.length !== 3 || new Set(run.traits).size !== 3 ||
      !knownIds(run.discoveries, data.discoveries) || !Array.isArray(run.flags) ||
      run.flags.length > flags.size || new Set(run.flags).size !== run.flags.length || run.flags.some(flag => !flags.has(flag))) return false;
  if (!Array.isArray(run.history) || !run.history.length || run.history.length > 100 || run.history.some(item =>
    !item || !Number.isInteger(item.turn) || item.turn < 0 || item.turn > run.turn || typeof item.title !== 'string' || typeof item.text !== 'string' ||
    !item.changes || typeof item.changes !== 'object' || Array.isArray(item.changes) || Object.entries(item.changes).some(([key, value]) =>
      !Object.hasOwn(RESOURCES, key) || !Number.isInteger(value) || Math.abs(value) > 10))) return false;
  if (run.pending !== null && !data.events.some(event => event.id === run.pending && event.turn === run.turn)) return false;
  if (run.ending !== null && !data.endings.some(ending => ending.id === run.ending)) return false;
  if (run.ending && run.pending) return false;
  if (run.stage === 'open' && !run.flags.includes('distributed')) return false;
  if (run.turn > 12 && run.stage !== 'open') return false;
  if (!run.ending && run.turn === 36 && run.pending !== 'world') return false;
  return true;
}

export function readSave(storage, data) {
  // The old reader validates its own rules. Merely finding a v1 JSON object is
  // insufficient evidence that its process can still be continued.
  const legacy = readLegacySave(storage, data);
  const inherited = archiveFrom(legacy.archive, data) || emptyArchive();
  const legacyAvailable = Boolean(legacy.run && !legacy.run.ending);
  const fallback = { run: null, archive: inherited, warning: '', legacyAvailable };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...fallback, warning: legacy.warning };
    const save = JSON.parse(raw);
    const archive = archiveFrom(save?.archive, data);
    if (save?.version !== 2 || !archive) throw new Error('archive');
    if (save.run !== null && !validRun(save.run, data)) return { run: null, archive, legacyAvailable,
      warning: '当前进程无法恢复，已发现的手记与世界结局仍保留。你可以开始新的一局。' };
    return { run: save.run, archive, warning: '', legacyAvailable };
  } catch {
    return { ...fallback, warning: '这份本地记录暂时无法读取。你可以开始新一局；继续游玩会建立新的记录。' };
  }
}

export function writeSave(storage, run, archive) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, run, archive })); return ''; }
  catch { return '浏览器未能保存记录。本次仍可游玩，关闭页面后进度可能丢失。'; }
}
