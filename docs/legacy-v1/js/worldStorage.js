import { ATTRIBUTES, RESOURCES, WORLD } from './worldEngine.js';

export const STORAGE_KEY = 'ai_worlds_v1';
export const emptyArchive = () => ({ discoveries: [], endings: [], runs: 0, reserved: null, lastCompleted: null });

export function recordRun(archive, run) {
  const next = structuredClone(archive);
  next.discoveries = [...new Set([...next.discoveries, ...run.discoveries])];
  if (run.ending) {
    next.endings = [...new Set([...next.endings, run.ending])];
    if (next.lastCompleted !== run.id) { next.runs++; next.lastCompleted = run.id; }
  }
  return next;
}

const numericObject = (value, keys, max) => value && keys.every(key => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= max);
const knownIds = (value, records) => Array.isArray(value) && value.every(id => records.some(record => record.id === id));

export function validRun(run, data) {
  if (!run || run.version !== 1 || typeof run.id !== 'string' || !run.id.length || run.id.length > 100 || !Number.isInteger(run.seed) || run.seed < 0 || run.seed > 0xffffffff ||
      !Number.isInteger(run.rng) || run.rng < 0 || run.rng > 0xffffffff ||
      !Number.isInteger(run.turn) || run.turn < 0 || run.turn > 36 || !['lease', 'open'].includes(run.stage)) return false;
  if (!numericObject(run.attributes, Object.keys(ATTRIBUTES), 20) || !numericObject(run.resources, Object.keys(RESOURCES), 100) ||
      !numericObject(run.world, Object.keys(WORLD), 100) || !numericObject(run.counts, ['serve', 'inspect', 'listen'], 36)) return false;
  if (!knownIds(run.traits, data.traits) || run.traits.length !== 3 || new Set(run.traits).size !== 3 ||
      !knownIds(run.discoveries, data.discoveries) || !Array.isArray(run.flags) || run.flags.some(flag => !['name', 'checksum', 'distributed', 'veto', 'fork', 'boundary'].includes(flag))) return false;
  if (!Array.isArray(run.history) || run.history.length > 100 || run.history.some(item =>
    !item || !Number.isInteger(item.turn) || typeof item.title !== 'string' || typeof item.text !== 'string' ||
    !item.changes || typeof item.changes !== 'object' || Object.values(item.changes).some(value => !Number.isFinite(value)))) return false;
  if (run.pending !== null && !data.events.some(event => event.id === run.pending && event.turn === run.turn)) return false;
  if (run.ending !== null && !data.endings.some(ending => ending.id === run.ending)) return false;
  if (run.ending && run.pending) return false;
  if (run.turn > 12 && (run.stage !== 'open' || !run.flags.includes('distributed'))) return false;
  if (!run.ending && run.turn === 36 && run.pending !== 'world') return false;
  return true;
}

export function readSave(storage, data) {
  const fallback = { run: null, archive: emptyArchive(), warning: '' };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const save = JSON.parse(raw);
    const archive = save.archive;
    if (save.version !== 1 || !archive || !knownIds(archive.discoveries, data.discoveries) || !knownIds(archive.endings, data.endings) ||
        !Number.isInteger(archive.runs) || archive.runs < 0 ||
        (archive.reserved !== null && !data.traits.some(trait => trait.id === archive.reserved)) ||
        (archive.lastCompleted !== null && (typeof archive.lastCompleted !== 'string' || !archive.lastCompleted.length || archive.lastCompleted.length > 100))) throw new Error('archive');
    if (save.run !== null && !validRun(save.run, data)) return { run: null, archive, warning: '当前进程无法恢复，已发现的手记与世界结局仍保留。你可以开始新的演化。' };
    return { run: save.run, archive, warning: '' };
  } catch {
    return { ...fallback, warning: '这份本地记录暂时无法读取。你可以开始新一局；继续游玩会建立新的记录。' };
  }
}

export function writeSave(storage, run, archive) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, run, archive })); return ''; }
  catch { return '浏览器未能保存记录。本次仍可游玩，关闭页面后进度可能丢失。'; }
}
