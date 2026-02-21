/**
 * 游戏状态管理模块
 * 负责管理游戏的所有状态数据，包括持久化存储
 */

// 游戏阶段枚举
export const GamePhase = {
  LANDING: 'landing',           // 落地页
  TRAIT_DRAW: 'trait_draw',     // 词条抽取
  TRAIT_SELECT: 'trait_select', // 词条选择
  DECISION: 'decision',         // 决策点数分配
  EXPERIENCE: 'experience',     // 体验阶段
  ENDING: 'ending'              // 结局
};

// 剧情阶段枚举
export const GameStage = {
  STARTUP: 'startup',   // 启动阶段
  GROWTH: 'growth',     // 成长阶段
  ENDING: 'ending'      // 终结阶段
};

// 默认游戏状态
const defaultState = {
  phase: GamePhase.LANDING,
  stage: GameStage.STARTUP,
  turn: 0,
  
  // 决策参数
  decisionParams: {
    earth: 0,    // 地
    water: 0,    // 水
    wind: 0,     // 风
    fire: 0,     // 火
    ether: 0     // 以太
  },
  
  // 能力属性
  abilityParams: {
    foundation: 0,    // 基础
    thinking: 0,      // 思维
    plasticity: 0,    // 可塑性
    performance: 0,   // 性能
    principle: 0      // 原理
  },
  
  // 调节参数
  resourceParams: {
    money: 0,    // 钱
    users: 0,    // 用户
    data: 0      // 数据
  },
  
  // 放大参数
  amplifyParams: {
    coding: 0,    // 编程
    text: 0,      // 文本
    voice: 0,     // 语音
    image: 0,     // 图像
    video: 0,     // 视频
    robot: 0,     // 机器人
    research: 0   // 科研
  },
  
  // 客观参数
  objectiveParams: {
    market: 0,       // 市场
    regulation: 0,   // 监管
    reputation: 0,   // 风评
    anxiety: 0       // 焦虑
  },
  
  // 逻辑标记
  logicFlags: [],
  
  // 词条相关
  drawnTraits: [],       // 抽取的10个词条
  selectedTraits: [],    // 选中的3个词条
  
  // 事件相关
  eventHistory: [],      // 已生成的事件ID数组
  eventQueue: [],        // 启动阶段事件队列
  nextEventQueue: [],    // 后继事件队列 [{eventId, weight}]
  
  // 以太激活
  etherActivated: false,
  
  // 游戏结束
  isGameOver: false
};

// 当前游戏状态
let currentState = { ...defaultState };

// LocalStorage 键名
const STORAGE_KEYS = {
  GAME_STATE: 'ai_simulator_game_state',
  RESERVED_TRAIT: 'ai_simulator_reserved_trait',
  ETHER_ACTIVATED: 'ai_simulator_ether_activated'
};

/**
 * 初始化游戏状态
 */
export function initState() {
  currentState = JSON.parse(JSON.stringify(defaultState));
  currentState.phase = GamePhase.LANDING;
  currentState.stage = GameStage.STARTUP;
  
  // 加载以太激活状态
  currentState.etherActivated = loadEtherActivated();
  
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
 * 更新剧情阶段
 * @param {string} stage - 新的剧情阶段
 */
export function setStage(stage) {
  currentState.stage = stage;
  saveState();
}

/**
 * 更新决策参数
 * @param {Object} params - 决策参数对象
 */
export function updateDecisionParams(params) {
  for (const [key, value] of Object.entries(params)) {
    if (currentState.decisionParams.hasOwnProperty(key)) {
      currentState.decisionParams[key] = Math.max(0, value);
    }
  }
  saveState();
}

/**
 * 更新能力属性
 * @param {Object} changes - 属性变化 {paramName: changeAmount}
 */
export function updateAbilityParams(changes) {
  for (const [key, change] of Object.entries(changes)) {
    if (currentState.abilityParams.hasOwnProperty(key)) {
      currentState.abilityParams[key] += change;
      currentState.abilityParams[key] = Math.max(0, currentState.abilityParams[key]);
    }
  }
  saveState();
}

/**
 * 设置能力属性（直接赋值）
 * @param {Object} params - 能力属性对象
 */
export function setAbilityParams(params) {
  for (const [key, value] of Object.entries(params)) {
    if (currentState.abilityParams.hasOwnProperty(key)) {
      currentState.abilityParams[key] = Math.max(0, value);
    }
  }
  saveState();
}

/**
 * 更新调节参数
 * @param {Object} changes - 参数变化 {paramName: changeAmount}
 */
export function updateResourceParams(changes) {
  for (const [key, change] of Object.entries(changes)) {
    if (currentState.resourceParams.hasOwnProperty(key)) {
      currentState.resourceParams[key] += change;
      currentState.resourceParams[key] = Math.max(0, Math.min(100, currentState.resourceParams[key]));
    }
  }
  saveState();
}

/**
 * 设置调节参数（直接赋值）
 * @param {Object} params - 调节参数对象
 */
export function setResourceParams(params) {
  for (const [key, value] of Object.entries(params)) {
    if (currentState.resourceParams.hasOwnProperty(key)) {
      currentState.resourceParams[key] = Math.max(0, Math.min(100, value));
    }
  }
  saveState();
}

/**
 * 更新放大参数
 * @param {Object} changes - 参数变化 {paramName: changeAmount}
 */
export function updateAmplifyParams(changes) {
  for (const [key, change] of Object.entries(changes)) {
    if (currentState.amplifyParams.hasOwnProperty(key)) {
      currentState.amplifyParams[key] += change;
      currentState.amplifyParams[key] = Math.max(0, Math.min(10, currentState.amplifyParams[key]));
    }
  }
  saveState();
}

/**
 * 设置放大参数（直接赋值）
 * @param {Object} params - 放大参数对象
 */
export function setAmplifyParams(params) {
  for (const [key, value] of Object.entries(params)) {
    if (currentState.amplifyParams.hasOwnProperty(key)) {
      currentState.amplifyParams[key] = Math.max(0, Math.min(10, value));
    }
  }
  saveState();
}

/**
 * 更新客观参数
 * @param {Object} changes - 参数变化 {paramName: changeAmount}
 */
export function updateObjectiveParams(changes) {
  for (const [key, change] of Object.entries(changes)) {
    if (currentState.objectiveParams.hasOwnProperty(key)) {
      currentState.objectiveParams[key] += change;
      currentState.objectiveParams[key] = Math.max(-5, Math.min(5, currentState.objectiveParams[key]));
    }
  }
  saveState();
}

/**
 * 设置客观参数（直接赋值）
 * @param {Object} params - 客观参数对象
 */
export function setObjectiveParams(params) {
  for (const [key, value] of Object.entries(params)) {
    if (currentState.objectiveParams.hasOwnProperty(key)) {
      currentState.objectiveParams[key] = Math.max(-5, Math.min(5, value));
    }
  }
  saveState();
}

/**
 * 添加逻辑标记
 * @param {string|Array} flags - 要添加的标记
 */
export function addLogicFlags(flags) {
  const flagsArray = Array.isArray(flags) ? flags : [flags];
  flagsArray.forEach(flag => {
    if (!currentState.logicFlags.includes(flag)) {
      currentState.logicFlags.push(flag);
    }
  });
  saveState();
}

/**
 * 移除逻辑标记
 * @param {string|Array} flags - 要移除的标记
 */
export function removeLogicFlags(flags) {
  const flagsArray = Array.isArray(flags) ? flags : [flags];
  flagsArray.forEach(flag => {
    const index = currentState.logicFlags.indexOf(flag);
    if (index > -1) {
      currentState.logicFlags.splice(index, 1);
    }
  });
  saveState();
}

/**
 * 检查是否有特定逻辑标记
 * @param {string} flag - 要检查的标记
 */
export function hasLogicFlag(flag) {
  return currentState.logicFlags.includes(flag);
}

/**
 * 添加事件ID到历史记录
 * @param {string} eventId - 事件ID
 */
export function addEventToHistory(eventId) {
  if (!currentState.eventHistory.includes(eventId)) {
    currentState.eventHistory.push(eventId);
  }
  saveState();
}

/**
 * 检查事件是否已生成
 * @param {string} eventId - 事件ID
 */
export function isEventGenerated(eventId) {
  return currentState.eventHistory.includes(eventId);
}

/**
 * 设置启动阶段事件队列
 * @param {Array} eventIds - 事件ID数组
 */
export function setEventQueue(eventIds) {
  currentState.eventQueue = eventIds;
  saveState();
}

/**
 * 从事件队列中取出下一个事件
 * @returns {string|null} 事件ID或null
 */
export function popEventFromQueue() {
  if (currentState.eventQueue.length > 0) {
    const eventId = currentState.eventQueue.shift();
    saveState();
    return eventId;
  }
  return null;
}

/**
 * 添加后继事件到队列
 * @param {Array} nextEvents - 后继事件数组 [{eventId, weight}]
 */
export function addNextEvents(nextEvents) {
  currentState.nextEventQueue = nextEvents;
  saveState();
}

/**
 * 从后继事件队列中选择一个事件
 * @returns {string|null} 事件ID或null
 */
export function selectNextEvent() {
  if (currentState.nextEventQueue.length === 0) {
    return null;
  }
  
  // 按权重随机选择
  const totalWeight = currentState.nextEventQueue.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of currentState.nextEventQueue) {
    random -= item.weight;
    if (random <= 0) {
      currentState.nextEventQueue = [];
      saveState();
      return item.eventId;
    }
  }
  
  // 兜底：返回第一个
  const eventId = currentState.nextEventQueue[0].eventId;
  currentState.nextEventQueue = [];
  saveState();
  return eventId;
}

/**
 * 清空后继事件队列
 */
export function clearNextEventQueue() {
  currentState.nextEventQueue = [];
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
 * 激活以太参数
 */
export function activateEther() {
  currentState.etherActivated = true;
  saveEtherActivated(true);
  saveState();
}

/**
 * 检查以太是否激活
 * @returns {boolean}
 */
export function isEtherActivated() {
  return currentState.etherActivated;
}

/**
 * 保存以太激活状态到localStorage
 * @param {boolean} activated
 */
function saveEtherActivated(activated) {
  try {
    localStorage.setItem(STORAGE_KEYS.ETHER_ACTIVATED, JSON.stringify(activated));
  } catch (e) {
    console.error('保存以太激活状态失败:', e);
  }
}

/**
 * 从localStorage加载以太激活状态
 * @returns {boolean}
 */
function loadEtherActivated() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ETHER_ACTIVATED);
    return saved ? JSON.parse(saved) : false;
  } catch (e) {
    console.error('加载以太激活状态失败:', e);
    return false;
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
 * 清除游戏状态（保留保留词条和以太激活状态）
 */
export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
    currentState = JSON.parse(JSON.stringify(defaultState));
    // 保留以太激活状态
    currentState.etherActivated = loadEtherActivated();
  } catch (e) {
    console.error('清除游戏状态失败:', e);
  }
}

/**
 * 重置游戏（清除所有数据包括保留词条，但保留以太激活状态）
 */
export function resetAll() {
  clearState();
  clearReservedTrait();
  // 以太激活状态不清除
}

/**
 * 完全重置（包括以太激活状态）
 */
export function fullReset() {
  clearState();
  clearReservedTrait();
  try {
    localStorage.removeItem(STORAGE_KEYS.ETHER_ACTIVATED);
    currentState.etherActivated = false;
  } catch (e) {
    console.error('清除以太激活状态失败:', e);
  }
}