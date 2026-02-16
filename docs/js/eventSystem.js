/**
 * 事件系统模块
 * 负责事件的加载、筛选、生成和效果应用
 */

import { getState } from './gameState.js';
import { getTraitModifiers } from './traitSystem.js';

// 事件数据缓存
let eventsData = [];

/**
 * 加载事件数据
 * @returns {Promise<Array>} 事件数组
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
 * @returns {Array} 事件数组
 */
export function getAllEvents() {
  return eventsData;
}

/**
 * 生成下一个事件
 * @returns {Object|null} 事件对象
 */
export function generateNextEvent() {
  const state = getState();
  
  // 首先检查是否应该触发结局
  const endingEvent = checkForEnding(state);
  if (endingEvent) {
    return endingEvent;
  }

  // 筛选符合条件的普通事件
  const availableEvents = filterAvailableEvents(state);
  
  if (availableEvents.length === 0) {
    // 如果没有符合条件的事件，返回一个默认事件
    return getDefaultEvent();
  }

  // 随机选择一个事件
  return availableEvents[Math.floor(Math.random() * availableEvents.length)];
}

/**
 * 检查是否触发结局
 * @param {Object} state - 游戏状态
 * @returns {Object|null} 结局事件或null
 */
function checkForEnding(state) {
  const endingEvents = eventsData.filter(e => e.type === 'ending');
  
  // 按优先级检查结局条件
  for (const event of endingEvents) {
    if (checkEventConditions(event, state)) {
      return event;
    }
  }
  
  return null;
}

/**
 * 筛选可用事件
 * @param {Object} state - 游戏状态
 * @returns {Array} 符合条件的事件数组
 */
function filterAvailableEvents(state) {
  // 排除结局事件
  const normalEvents = eventsData.filter(e => e.type !== 'ending');
  
  // 筛选符合条件的事件
  return normalEvents.filter(event => checkEventConditions(event, state));
}

/**
 * 检查事件条件是否满足
 * @param {Object} event - 事件对象
 * @param {Object} state - 游戏状态
 * @returns {boolean} 是否满足条件
 */
function checkEventConditions(event, state) {
  const conditions = event.conditions || {};
  
  // 检查回合数范围
  if (conditions.turnRange) {
    const [min, max] = conditions.turnRange;
    if (state.turn < min || state.turn > max) {
      return false;
    }
  }

  // 检查最小回合数
  if (conditions.minTurn !== undefined && state.turn < conditions.minTurn) {
    return false;
  }

  // 检查最大回合数
  if (conditions.maxTurn !== undefined && state.turn > conditions.maxTurn) {
    return false;
  }

  // 检查资产范围
  if (conditions.minAssets !== undefined && state.assets < conditions.minAssets) {
    return false;
  }

  if (conditions.maxAssets !== undefined && state.assets > conditions.maxAssets) {
    return false;
  }

  // 检查属性要求
  if (conditions.minAttributes) {
    for (const [attr, minValue] of Object.entries(conditions.minAttributes)) {
      if (state.attributes[attr] < minValue) {
        return false;
      }
    }
  }

  if (conditions.maxAttributes) {
    for (const [attr, maxValue] of Object.entries(conditions.maxAttributes)) {
      if (state.attributes[attr] > maxValue) {
        return false;
      }
    }
  }

  // 检查必需词条
  if (conditions.requiredTraits) {
    const traitIds = state.selectedTraits.map(t => t.id);
    const hasRequiredTrait = conditions.requiredTraits.some(reqTrait => {
      // 支持词条ID或词条修饰符
      return traitIds.includes(reqTrait) || 
             state.selectedTraits.some(t => 
               t.effects?.eventModifier?.includes(reqTrait)
             );
    });
    if (!hasRequiredTrait) {
      return false;
    }
  }

  // 检查必需标记
  if (conditions.tags) {
    const requiredTags = Array.isArray(conditions.tags) ? conditions.tags : [conditions.tags];
    const hasAllTags = requiredTags.every(tag => state.tags.includes(tag));
    if (!hasAllTags) {
      return false;
    }
  }

  // 检查排除标记
  if (conditions.excludeTags) {
    const excludeTags = Array.isArray(conditions.excludeTags) ? conditions.excludeTags : [conditions.excludeTags];
    const hasExcludedTag = excludeTags.some(tag => state.tags.includes(tag));
    if (hasExcludedTag) {
      return false;
    }
  }

  return true;
}

/**
 * 获取默认事件（当没有符合条件的事件时）
 * @returns {Object} 默认事件
 */
function getDefaultEvent() {
  return {
    id: 'default',
    name: '平静的一天',
    description: '今天风平浪静，没有什么特别的事情发生。',
    type: 'trivial',
    effects: {
      assets: 10,
      attributes: {},
      tags: []
    }
  };
}

/**
 * 应用事件效果
 * @param {Object} event - 事件对象
 * @returns {Object} 效果摘要
 */
export function applyEventEffects(event) {
  const effects = event.effects || {};
  const summary = {
    assetsChange: effects.assets || 0,
    attributeChanges: effects.attributes || {},
    newTags: effects.tags || []
  };

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
    normal: '重要事件',
    trivial: '日常事件',
    ending: '结局'
  };
  return typeMap[type] || '事件';
}

/**
 * 格式化资产变化文本
 * @param {number} change - 资产变化量
 * @returns {string} 格式化文本
 */
export function formatAssetsChange(change) {
  if (change > 0) {
    return `<span class="text-green-600">+${change}</span>`;
  } else if (change < 0) {
    return `<span class="text-red-600">${change}</span>`;
  }
  return '<span class="text-gray-600">0</span>';
}

/**
 * 格式化属性变化文本
 * @param {Object} changes - 属性变化对象
 * @returns {string} 格式化文本
 */
export function formatAttributeChanges(changes) {
  const attributeNames = {
    efficiency: '效率与规模',
    cognition: '认知能力',
    controllability: '可控度',
    adaptability: '适应能力',
    explainability: '可解释性'
  };

  const parts = [];
  for (const [attr, change] of Object.entries(changes)) {
    if (change !== 0) {
      const name = attributeNames[attr] || attr;
      const color = change > 0 ? 'text-green-600' : 'text-red-600';
      const sign = change > 0 ? '+' : '';
      parts.push(`<span class="${color}">${name}${sign}${change}</span>`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : '<span class="text-gray-600">无变化</span>';
}
