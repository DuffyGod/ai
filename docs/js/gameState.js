/**
 * 游戏状态管理模块
 * 负责管理游戏的所有状态数据，包括持久化存储
 */

// 游戏阶段枚举
export const GamePhase = {
  LANDING: 'landing',           // 落地页
  TRAIT_DRAW: 'trait_draw',     // 词条抽取
  TRAIT_SELECT: 'trait_select', // 词条选择
  ATTRIBUTE: 'attribute',       // 属性分配
  EXPERIENCE: 'experience',     // 体验阶段
  ENDING: 'ending'              // 结局
};

// 默认游戏状态
const defaultState = {
  phase: GamePhase.LANDING,
  turn: 0,
  assets: 500,
  attributes: {
    efficiency: 50,      // 效率与规模
    cognition: 50,       // 认知能力
    controllability: 50, // 可控度
    adaptability: 50,    // 适应能力
    explainability: 50   // 可解释性
  },
  decisionPoints: 10,    // 决策点数
  allocatedPoints: {     // 已分配的决策点数
    efficiency: 0,
    cognition: 0,
    controllability: 0,
    adaptability: 0,
    explainability: 0
  },
  drawnTraits: [],       // 抽取的10个词条
  selectedTraits: [],    // 选中的3个词条
  eventHistory: [],      // 事件历史记录
  tags: [],              // 状态标记
  isGameOver: false
};

// 当前游戏状态
let currentState = { ...defaultState };

// LocalStorage 键名
const STORAGE_KEYS = {
  GAME_STATE: 'ai_simulator_game_state',
  RESERVED_TRAIT: 'ai_simulator_reserved_trait'
};

/**
 * 初始化游戏状态
 */
export function initState() {
  currentState = JSON.parse(JSON.stringify(defaultState));
  currentState.phase = GamePhase.LANDING;
  saveState();
}

/**
 * 获取当前游戏状态
 */
export function getState() {
  return currentState;
}

/**
 * 更新游戏状态
 * @param {Object} updates - 要更新的状态字段
 */
export function updateState(updates) {
  currentState = {
    ...currentState,
    ...updates
  };
  saveState();
}

/**
 * 更新游戏阶段
 * @param {string} phase - 新的游戏阶段
 */
export function setPhase(phase) {
  currentState.phase = phase;
  saveState();
}

/**
 * 更新资产
 * @param {number} amount - 资产变化量（可为负数）
 */
export function updateAssets(amount) {
  currentState.assets += amount;
  saveState();
}

/**
 * 更新属性值
 * @param {Object} attributeChanges - 属性变化 {attributeName: changeAmount}
 */
export function updateAttributes(attributeChanges) {
  for (const [attr, change] of Object.entries(attributeChanges)) {
    if (currentState.attributes.hasOwnProperty(attr)) {
      currentState.attributes[attr] += change;
      // 限制属性值在0-100之间
      currentState.attributes[attr] = Math.max(0, Math.min(100, currentState.attributes[attr]));
    }
  }
  saveState();
}

/**
 * 添加状态标记
 * @param {string|Array} tags - 要添加的标记
 */
export function addTags(tags) {
  const tagsArray = Array.isArray(tags) ? tags : [tags];
  tagsArray.forEach(tag => {
    if (!currentState.tags.includes(tag)) {
      currentState.tags.push(tag);
    }
  });
  saveState();
}

/**
 * 检查是否有特定标记
 * @param {string} tag - 要检查的标记
 */
export function hasTag(tag) {
  return currentState.tags.includes(tag);
}

/**
 * 添加事件到历史记录
 * @param {Object} event - 事件对象
 */
export function addEventToHistory(event) {
  currentState.eventHistory.push({
    turn: currentState.turn,
    ...event,
    timestamp: Date.now()
  });
  saveState();
}

/**
 * 增加回合数
 */
export function incrementTurn() {
  currentState.turn++;
  saveState();
}

/**
 * 设置抽取的词条
 * @param {Array} traits - 词条数组
 */
export function setDrawnTraits(traits) {
  currentState.drawnTraits = traits;
  saveState();
}

/**
 * 设置选中的词条
 * @param {Array} traits - 词条数组
 */
export function setSelectedTraits(traits) {
  currentState.selectedTraits = traits;
  saveState();
}

/**
 * 分配决策点数
 * @param {Object} allocation - 点数分配 {attributeName: points}
 */
export function allocateDecisionPoints(allocation) {
  currentState.allocatedPoints = allocation;
  saveState();
}

/**
 * 设置游戏结束状态
 */
export function setGameOver() {
  currentState.isGameOver = true;
  saveState();
}

/**
 * 保存保留词条
 * @param {Object} trait - 要保留的词条对象
 */
export function saveReservedTrait(trait) {
  try {
    localStorage.setItem(STORAGE_KEYS.RESERVED_TRAIT, JSON.stringify(trait));
  } catch (e) {
    console.error('保存保留词条失败:', e);
  }
}

/**
 * 获取保留词条
 * @returns {Object|null} 保留的词条对象或null
 */
export function getReservedTrait() {
  try {
    const trait = localStorage.getItem(STORAGE_KEYS.RESERVED_TRAIT);
    return trait ? JSON.parse(trait) : null;
  } catch (e) {
    console.error('读取保留词条失败:', e);
    return null;
  }
}

/**
 * 清除保留词条
 */
export function clearReservedTrait() {
  try {
    localStorage.removeItem(STORAGE_KEYS.RESERVED_TRAIT);
  } catch (e) {
    console.error('清除保留词条失败:', e);
  }
}

/**
 * 保存游戏状态到localStorage
 */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(currentState));
  } catch (e) {
    console.error('保存游戏状态失败:', e);
  }
}

/**
 * 从localStorage加载游戏状态
 * @returns {boolean} 是否成功加载
 */
export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (saved) {
      currentState = JSON.parse(saved);
      return true;
    }
  } catch (e) {
    console.error('加载游戏状态失败:', e);
  }
  return false;
}

/**
 * 清除游戏状态（保留保留词条）
 */
export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
    currentState = JSON.parse(JSON.stringify(defaultState));
  } catch (e) {
    console.error('清除游戏状态失败:', e);
  }
}

/**
 * 重置游戏（清除所有数据包括保留词条）
 */
export function resetAll() {
  clearState();
  clearReservedTrait();
}
