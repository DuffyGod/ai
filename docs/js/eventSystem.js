/**
 * 事件系统模块
 * 负责事件的加载、筛选、生成和效果应用
 * 
 * @module eventSystem
 */

import { getState, updateResourceParams, updateAbilityParams, updateAmplifyParams, updateObjectiveParams } from './gameState.js';
import { getParamValue, checkCondition, checkConditions, evaluateConditions, parseConditionKey } from './utils/paramUtils.js';
import { validateEventData, validateJudgmentEvent, fixEventData, getDefaultEvent, getDefaultStartupEvent } from './utils/eventValidator.js';

// 事件数据缓存
let eventsData = [];

/**
 * 加载事件数据
 * 从events.json文件加载所有事件数据并缓存
 * 
 * @async
 * @returns {Promise<Array<Object>>} 事件数组
 * @throws {Error} 加载失败时抛出错误
 * 
 * @example
 * await loadEvents();
 */
export async function loadEvents() {
  try {
    const response = await fetch('./data/events.json');
    eventsData = await response.json();
    return eventsData;
  } catch (error) {
    console.error('加载事件数据失败:', error);
    return [];
  }
}

/**
 * 获取所有事件
 * 返回缓存的事件数据数组
 * 
 * @returns {Array<Object>} 事件数组
 * 
 * @example
 * const allEvents = getAllEvents();
 */
export function getAllEvents() {
  return eventsData;
}

/**
 * 生成下一个事件
 * 根据当前游戏状态和阶段生成合适的事件
 * 优先检查结局条件，然后根据阶段选择事件生成策略
 * 
 * @returns {Object|null} 处理后的事件对象，如果无法生成则返回默认事件
 * 
 * @example
 * const event = generateNextEvent();
 * if (event) {
 *   applyEventEffects(event);
 * }
 */
export function generateNextEvent() {
  const state = getState();
  
  // 首先检查是否应该触发结局
  const endingEvent = checkForEnding(state);
  if (endingEvent) {
    return processEvent(endingEvent);
  }

  // 启动阶段特殊处理：为每个参数选择对应的事件
  if (state.stage === 'startup') {
    return generateStartupEvent(state);
  }

  // 其他阶段：根据剧情阶段筛选事件
  const stageEvents = eventsData.filter(e => e.stage === state.stage && e.type !== 'ending');
  
  // 筛选符合条件的事件（只对trigger和judgment类型检查条件）
  const availableEvents = stageEvents.filter(event => {
    // normal类型事件无条件触发
    if (event.type === 'normal' || event.type === 'trivial') {
      return true;
    }
    // trigger和judgment类型需要检查条件
    return checkEventConditions(event, state);
  });
  
  if (availableEvents.length === 0) {
    // 如果没有符合条件的事件，返回一个默认事件
    return getDefaultEvent();
  }

  // 随机选择一个事件
  const selectedEvent = availableEvents[Math.floor(Math.random() * availableEvents.length)];
  return processEvent(selectedEvent);
}

/**
 * 生成启动阶段事件
 * 随机选择一个决策参数，并根据参数值筛选对应的启动事件
 * 
 * @private
 * @param {Object} state - 游戏状态
 * @param {Object} state.decisionParams - 决策参数
 * @returns {Object} 处理后的事件对象
 * 
 * @example
 * const event = generateStartupEvent(state);
 */
function generateStartupEvent(state) {
  const params = ['earth', 'water', 'wind', 'fire'];
  const selectedParam = params[Math.floor(Math.random() * params.length)];
  const paramValue = state.decisionParams[selectedParam] || 0;
  
  // 根据参数值筛选对应的事件池
  const paramEvents = eventsData.filter(e => {
    if (e.stage !== 'startup') return false;
    if (!e.readParams || !e.readParams.includes(selectedParam)) return false;
    
    // 检查paramRange条件（如果有的话）
    if (e.paramRange) {
      return checkConditions(e.paramRange, state);
    }
    
    return true;
  });
  
  // 如果有对应的事件，随机选择一个
  if (paramEvents.length > 0) {
    const selectedEvent = paramEvents[Math.floor(Math.random() * paramEvents.length)];
    return processEvent(selectedEvent);
  }
  
  // 如果没有对应的事件，选择一个通用的启动事件
  const fallbackEvents = eventsData.filter(e => 
    e.stage === 'startup' && 
    (!e.readParams || e.readParams.length === 0)
  );
  
  if (fallbackEvents.length > 0) {
    const selectedEvent = fallbackEvents[Math.floor(Math.random() * fallbackEvents.length)];
    return processEvent(selectedEvent);
  }
  
  return getDefaultStartupEvent();
}

/**
 * 处理事件
 * 验证事件数据、选择文本变体、处理判定分支等
 * 返回完整的、可直接使用的事件对象
 * 
 * @private
 * @param {Object} event - 原始事件对象
 * @param {string} event.id - 事件ID
 * @param {string} event.name - 事件名称
 * @param {string} event.type - 事件类型
 * @param {Array<string>} [event.texts] - 文本变体数组
 * @param {string} [event.description] - 事件描述
 * @param {Object} [event.conditions] - 条件对象
 * @param {Object} [event.condition] - 判定条件（仅judgment类型）
 * @param {Object} [event.pass] - 通过分支（仅judgment类型）
 * @param {Object} [event.fail] - 失败分支（仅judgment类型）
 * @returns {Object} 处理后的事件对象
 * 
 * @example
 * const processedEvent = processEvent(rawEvent);
 */
function processEvent(event) {
  try {
    const state = getState();
    
    // 验证事件数据
    const validation = validateEventData(event);
    if (!validation.isValid) {
      console.error(`事件数据无效 (${event.id}):`, validation.errors);
      return fixEventData(event);
    }
    
    const processedEvent = { ...event };
    
    // 选择文本变体
    if (event.texts && event.texts.length > 0) {
      processedEvent.description = event.texts[Math.floor(Math.random() * event.texts.length)];
    } else if (!event.description) {
      // 如果既没有texts数组也没有description字段，设置默认描述
      processedEvent.description = event.name || '发生了一些事情...';
    }
    
    // 记录条件判断结果（用于前端显示）
    if (event.conditions && Object.keys(event.conditions).length > 0) {
      processedEvent.conditionResults = evaluateConditions(event.conditions, state);
    }
    
    // 处理判定事件
    if (event.type === 'judgment') {
      // 验证判定事件结构
      const judgmentValidation = validateJudgmentEvent(event);
      if (!judgmentValidation.isValid) {
        console.error(`判定事件数据无效 (${event.id}):`, judgmentValidation.errors);
      }
      
      if (event.condition) {
        // 使用新的 condition/pass/fail 结构
        const isPassed = evaluateJudgmentCondition(event.condition, state);
        const result = isPassed ? event.pass : event.fail;
        
        // 设置描述文本
        if (result && result.text) {
          processedEvent.description = result.text;
        } else {
          // result不存在或没有text字段，使用事件名称
          processedEvent.description = event.name || '判定事件';
          console.warn(`判定事件 ${event.id} 的结果缺少text字段`);
        }
        
        // 设置效果和通过状态
        processedEvent.effects = (result && result.effects) ? result.effects : {};
        processedEvent.isPassed = isPassed;
      } else {
        console.error(`判定事件 ${event.id} 缺少 condition 字段`);
        processedEvent.description = event.name || '判定事件';
        processedEvent.effects = {};
      }
    }
    
    return processedEvent;
  } catch (error) {
    console.error('处理事件时发生错误:', error, event);
    return fixEventData(event);
  }
}

/**
 * 评估判定事件的条件
 * @param {Object} condition - 条件对象 {param, operator, value}
 * @param {Object} state - 游戏状态
 * @returns {boolean} 是否通过判定
 */
function evaluateJudgmentCondition(condition, state) {
  const { param, operator, value } = condition;
  const paramValue = getParamValue(param, state);
  return checkCondition(paramValue, operator, value);
}

/**
 * 检查事件条件是否满足
 * @param {Object} event - 事件对象
 * @param {Object} state - 游戏状态
 * @returns {boolean} 是否满足条件
 */
function checkEventConditions(event, state) {
  // 检查剧情阶段
  if (event.stage && event.stage !== state.stage) {
    return false;
  }
  
  // 检查各类参数条件
  const conditions = event.conditions || {};
  return checkConditions(conditions, state);
}

/**
 * 检查是否触发结局
 * @param {Object} state - 游戏状态
 * @returns {Object|null} 结局事件或null
 */
function checkForEnding(state) {
  // 只在终结阶段或满足特定条件时检查结局
  if (state.stage !== 'ending' && state.turn < 20) {
    return null;
  }
  
  const endingEvents = eventsData.filter(e => e.type === 'ending');
  
  // 按优先级检查结局条件（稀有度高的优先）
  const sortedEndings = endingEvents.sort((a, b) => {
    const rarityOrder = { epic: 3, rare: 2, common: 1 };
    return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
  });
  
  for (const event of sortedEndings) {
    if (checkEventConditions(event, state)) {
      console.log(`触发结局: ${event.name} (${event.rarity})`);
      return event;
    }
  }
  
  return null;
}

/**
 * 准备启动阶段事件队列
 * 为每个决策参数选择对应的事件，并添加背景事件和随机事件
 * 
 * @param {Object} decisionParams - 决策参数 {earth, water, wind, fire}
 * @param {Array} allEvents - 所有事件数据
 * @returns {Array<string>} 事件ID队列
 */
export function prepareStartupEvents(decisionParams, allEvents = eventsData) {
  const eventQueue = [];
  
  // 1. 背景事件（固定第一个）
  eventQueue.push('e_startup_background');
  
  // 2. 为每个决策参数选择对应的事件
  const params = ['earth', 'water', 'wind', 'fire'];
  const initEventIds = [];
  
  for (const param of params) {
    const paramValue = decisionParams[param] || 0;
    
    // 获取该参数对应的所有事件
    const paramEvents = allEvents.filter(e => {
      if (e.stage !== 'startup') return false;
      if (e.id === 'e_startup_background') return false; // 排除背景事件
      if (e.id === 'e_startup_random_1' || e.id === 'e_startup_random_2') return false; // 排除随机事件
      if (!e.readParams || !e.readParams.includes(param)) return false;
      
      // 检查paramRange条件
      if (e.paramRange) {
        // 创建临时状态对象用于条件检查
        const tempState = { decisionParams };
        return checkConditions(e.paramRange, tempState);
      }
      
      return true;
    });
    
    // 从符合条件的事件中随机选择一个
    if (paramEvents.length > 0) {
      const selectedEvent = paramEvents[Math.floor(Math.random() * paramEvents.length)];
      initEventIds.push(selectedEvent.id);
      console.log(`参数 ${param} (值=${paramValue}) 选择事件: ${selectedEvent.name}`);
    } else {
      // 如果没有找到符合条件的事件，记录警告
      console.warn(`未找到参数 ${param} (值=${paramValue}) 对应的启动事件`);
    }
  }
  
  // 3. 随机事件（1-2个）
  const randomEventIds = ['e_startup_random_1', 'e_startup_random_2'];
  const numRandomEvents = Math.random() > 0.5 ? 2 : 1;
  
  for (let i = 0; i < numRandomEvents; i++) {
    initEventIds.push(randomEventIds[i]);
  }
  
  // 4. 打乱初始化事件和随机事件的顺序
  const shuffled = initEventIds.sort(() => Math.random() - 0.5);
  
  // 5. 将打乱后的事件添加到队列
  eventQueue.push(...shuffled);
  
  console.log('启动阶段事件队列已准备:', eventQueue);
  
  return eventQueue;
}

/**
 * 从队列获取下一个启动阶段事件
 * 
 * @param {string} eventId - 事件ID
 * @param {Array} allEvents - 所有事件数据
 * @param {Object} state - 游戏状态
 * @returns {Object|null} 处理后的事件对象
 */
export function getNextStartupEvent(eventId, allEvents = eventsData, state = null) {
  if (!eventId) {
    console.warn('事件ID为空');
    return null;
  }
  
  // 从事件数据中找到对应事件
  const eventData = allEvents.find(e => e.id === eventId);
  
  if (!eventData) {
    console.error(`未找到事件ID对应的事件数据: ${eventId}`);
    return getDefaultStartupEvent();
  }
  
  console.log(`处理启动事件: ${eventData.name} (${eventId})`);
  
  // 处理事件（选择文本变体、判定分支等）
  return processEvent(eventData);
}

/**
 * 生成成长阶段事件
 * 智能筛选事件：优先trigger/judgment，次选normal/trivial
 * 
 * @param {Object} state - 游戏状态
 * @param {Array} allEvents - 所有事件数据
 * @param {Array} recentEvents - 最近的事件ID列表（用于去重）
 * @returns {Object} 事件对象
 */
export function generateGrowthEvent(state, allEvents = eventsData, recentEvents = []) {
  // 筛选当前阶段的事件（排除结局事件）
  const stageEvents = allEvents.filter(e => 
    e.stage === state.stage && e.type !== 'ending'
  );
  
  // 1. 优先选择符合条件的trigger和judgment事件
  const specialEvents = stageEvents.filter(event => {
    if (event.type !== 'trigger' && event.type !== 'judgment') {
      return false;
    }
    return checkEventConditions(event, state);
  });
  
  // 过滤掉最近出现过的事件（避免重复）
  const availableSpecialEvents = specialEvents.filter(e => 
    !recentEvents.includes(e.id)
  );
  
  if (availableSpecialEvents.length > 0) {
    const selectedEvent = availableSpecialEvents[Math.floor(Math.random() * availableSpecialEvents.length)];
    console.log(`生成特殊事件: ${selectedEvent.name} (${selectedEvent.type})`);
    return processEvent(selectedEvent);
  }
  
  // 2. 如果没有特殊事件，从normal和trivial事件中随机选择
  const normalEvents = stageEvents.filter(event => 
    (event.type === 'normal' || event.type === 'trivial') &&
    !recentEvents.includes(event.id)
  );
  
  if (normalEvents.length > 0) {
    const selectedEvent = normalEvents[Math.floor(Math.random() * normalEvents.length)];
    console.log(`生成普通事件: ${selectedEvent.name} (${selectedEvent.type})`);
    return processEvent(selectedEvent);
  }
  
  // 3. 如果所有事件都被过滤掉了，放宽限制（允许重复）
  const fallbackEvents = stageEvents.filter(event => 
    event.type === 'normal' || event.type === 'trivial'
  );
  
  if (fallbackEvents.length > 0) {
    const selectedEvent = fallbackEvents[Math.floor(Math.random() * fallbackEvents.length)];
    console.log(`生成兜底事件: ${selectedEvent.name}`);
    return processEvent(selectedEvent);
  }
  
  // 4. 最后的兜底
  console.warn('无法生成成长阶段事件，使用默认事件');
  return getDefaultEvent();
}

/**
 * 检查结局条件（按稀有度优先级）
 * 
 * @param {Object} state - 游戏状态
 * @param {Array} allEvents - 所有事件数据
 * @returns {Object|null} 结局事件或null
 */
export function checkEndings(state, allEvents = eventsData) {
  // 只在终结阶段或满足特定条件时检查结局
  if (state.stage !== 'ending' && state.turn < 20) {
    return null;
  }
  
  const endingEvents = allEvents.filter(e => e.type === 'ending');
  
  // 按稀有度优先级排序（epic > rare > common）
  const sortedEndings = endingEvents.sort((a, b) => {
    const rarityOrder = { epic: 3, rare: 2, common: 1 };
    return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
  });
  
  // 按优先级检查每个结局的条件
  for (const event of sortedEndings) {
    if (checkEventConditions(event, state)) {
      console.log(`触发结局: ${event.name} (${event.rarity})`);
      return processEvent(event);
    }
  }
  
  return null;
}

/**
 * 应用事件效果
 * @param {Object} event - 事件对象
 * @returns {Object} 效果摘要
 */
export function applyEventEffects(event) {
  const state = getState();
  const effects = event.effects || {};
  const summary = {
    paramChanges: {}
  };
  
  // 应用各类参数变化
  for (const [key, value] of Object.entries(effects)) {
    // 能力属性
    if (['foundation', 'thinking', 'plasticity', 'performance', 'principle'].includes(key)) {
      if (typeof value === 'string' && value.startsWith('=')) {
        // 赋值操作
        const sourceParam = value.substring(1);
        const sourceValue = getParamValue(sourceParam, state);
        updateAbilityParams({ [key]: sourceValue });
        summary.paramChanges[key] = sourceValue;
      } else {
        // 增量操作
        updateAbilityParams({ [key]: value });
        summary.paramChanges[key] = value;
      }
    }
    // 调节参数
    else if (['money', 'users', 'data'].includes(key)) {
      updateResourceParams({ [key]: value });
      summary.paramChanges[key] = value;
    }
    // 放大参数
    else if (['coding', 'text', 'voice', 'image', 'video', 'robot', 'research'].includes(key)) {
      updateAmplifyParams({ [key]: value });
      summary.paramChanges[key] = value;
    }
    // 客观参数
    else if (['market', 'regulation', 'reputation', 'anxiety'].includes(key)) {
      updateObjectiveParams({ [key]: value });
      summary.paramChanges[key] = value;
    }
  }
  
  return summary;
}

/**
 * 判断事件是否为结局事件
 * @param {Object} event - 事件对象
 * @returns {boolean} 是否为结局
 */
export function isEndingEvent(event) {
  return event && event.type === 'ending';
}

/**
 * 获取事件类型的中文名称
 * @param {string} type - 事件类型
 * @returns {string} 中文名称
 */
export function getEventTypeName(type) {
  const typeMap = {
    normal: '事件',
    judgment: '判定',
    trigger: '触发',
    trivial: '日常',
    ending: '结局'
  };
  return typeMap[type] || '事件';
}