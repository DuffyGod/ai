/**
 * 词条系统模块
 * 负责词条的抽取、选择和效果应用
 */

import { getReservedTrait, updateDecisionParams, getState } from './gameState.js';

// 词条数据缓存
let traitsData = [];

// 稀有度权重配置
const RARITY_WEIGHTS = {
  common: 79,      // 白色 79%
  rare: 16,        // 蓝色 16%
  epic: 4,         // 紫色 4%
  legendary: 1     // 金色 1%
};

/**
 * 加载词条数据
 * @returns {Promise<Array>} 词条数组
 */
export async function loadTraits() {
  try {
    const response = await fetch('./data/traits.json');
    traitsData = await response.json();
    return traitsData;
  } catch (error) {
    console.error('加载词条数据失败:', error);
    return [];
  }
}

/**
 * 获取所有词条
 * @returns {Array} 词条数组
 */
export function getAllTraits() {
  return traitsData;
}

/**
 * 根据ID获取词条
 * @param {string} traitId - 词条ID
 * @returns {Object|null} 词条对象
 */
export function getTraitById(traitId) {
  return traitsData.find(t => t.id === traitId) || null;
}

/**
 * 抽取10个词条
 * @returns {Array} 抽取的10个词条
 */
export function drawTraits() {
  if (traitsData.length === 0) {
    console.error('词条数据未加载');
    return [];
  }

  const drawn = [];
  
  // 检查是否有保留词条
  const reservedTrait = getReservedTrait();
  if (reservedTrait) {
    // 确保保留词条在数据中存在
    const trait = traitsData.find(t => t.id === reservedTrait.id);
    if (trait) {
      drawn.push(trait);
    }
  }

  // 按稀有度分组
  const traitsByRarity = {
    common: traitsData.filter(t => t.rarity === 'common'),
    rare: traitsData.filter(t => t.rarity === 'rare'),
    epic: traitsData.filter(t => t.rarity === 'epic'),
    legendary: traitsData.filter(t => t.rarity === 'legendary')
  };

  // 抽取剩余词条
  const remainingCount = 10 - drawn.length;
  for (let i = 0; i < remainingCount; i++) {
    const trait = drawSingleTrait(traitsByRarity, drawn);
    if (trait) {
      drawn.push(trait);
    }
  }

  // 检查前9个是否都是普通稀有度，如果是则强制第10个为非普通稀有度
  if (drawn.length === 10) {
    const first9AllCommon = drawn.slice(0, 9).every(t => t.rarity === 'common');
    if (first9AllCommon && drawn[9].rarity === 'common') {
      // 第10个也是普通，需要替换为非普通词条
      const nonCommonTraits = traitsData.filter(
        t => t.rarity !== 'common' && !drawn.slice(0, 9).find(e => e.id === t.id)
      );
      
      if (nonCommonTraits.length > 0) {
        // 按稀有度权重选择（排除普通）
        const nonCommonWeights = {
          rare: RARITY_WEIGHTS.rare,
          epic: RARITY_WEIGHTS.epic,
          legendary: RARITY_WEIGHTS.legendary
        };
        const totalWeight = Object.values(nonCommonWeights).reduce((sum, w) => sum + w, 0);
        
        let random = Math.random() * totalWeight;
        let selectedRarity = 'rare';
        
        for (const [rarity, weight] of Object.entries(nonCommonWeights)) {
          random -= weight;
          if (random <= 0) {
            selectedRarity = rarity;
            break;
          }
        }
        
        // 从选定稀有度中随机选择
        const availableInRarity = nonCommonTraits.filter(t => t.rarity === selectedRarity);
        if (availableInRarity.length > 0) {
          drawn[9] = availableInRarity[Math.floor(Math.random() * availableInRarity.length)];
        } else {
          // 如果该稀有度没有可用词条，随机选择任意非普通词条
          drawn[9] = nonCommonTraits[Math.floor(Math.random() * nonCommonTraits.length)];
        }
      }
    }
  }

  return drawn;
}

/**
 * 抽取单个词条（按权重随机）
 * @param {Object} traitsByRarity - 按稀有度分组的词条
 * @param {Array} excludeTraits - 要排除的词条
 * @returns {Object|null} 抽取的词条
 */
function drawSingleTrait(traitsByRarity, excludeTraits) {
  // 计算总权重
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((sum, w) => sum + w, 0);
  
  // 随机选择稀有度
  let random = Math.random() * totalWeight;
  let selectedRarity = 'common';
  
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      selectedRarity = rarity;
      break;
    }
  }

  // 从该稀有度中随机选择一个词条
  const availableTraits = traitsByRarity[selectedRarity].filter(
    t => !excludeTraits.find(e => e.id === t.id)
  );

  if (availableTraits.length === 0) {
    // 如果该稀有度没有可用词条，从所有词条中随机选择
    const allAvailable = traitsData.filter(
      t => !excludeTraits.find(e => e.id === t.id)
    );
    if (allAvailable.length === 0) return null;
    return allAvailable[Math.floor(Math.random() * allAvailable.length)];
  }

  return availableTraits[Math.floor(Math.random() * availableTraits.length)];
}

/**
 * 验证词条选择是否有效
 * @param {Array} selectedTraits - 选中的词条数组
 * @returns {boolean} 是否有效
 */
export function validateTraitSelection(selectedTraits) {
  return selectedTraits && selectedTraits.length === 3;
}

/**
 * 应用词条效果（新版本 - 支持决策词条、事件词条、介绍词条）
 * @param {Array} selectedTraits - 选中的词条数组（按选择顺序）
 * @param {Object} currentDecisionParams - 当前决策参数
 * @returns {Object} 结果对象 {decisionParams, boundEvents}
 */
export function applyNewTraitEffects(selectedTraits, currentDecisionParams) {
  const result = {
    decisionParams: { ...currentDecisionParams },
    boundEvents: []  // 绑定的事件ID数组
  };
  
  // 按选择顺序依次结算词条
  for (const trait of selectedTraits) {
    if (trait.type === 'decision') {
      // 决策词条：检查条件并应用修改
      applyDecisionTrait(trait, result.decisionParams);
    } else if (trait.type === 'event') {
      // 事件词条：记录绑定的事件ID
      if (trait.effects && trait.effects.eventId) {
        result.boundEvents.push(trait.effects.eventId);
      }
    }
    // intro类型不做任何操作
  }
  
  return result;
}

/**
 * 应用决策词条效果
 * @param {Object} trait - 决策词条对象
 * @param {Object} decisionParams - 决策参数对象（会被修改）
 */
function applyDecisionTrait(trait, decisionParams) {
  if (!trait.effects) return;
  
  // 检查条件
  if (trait.effects.conditions && trait.effects.conditions.length > 0) {
    if (!checkTraitConditions(trait.effects.conditions, decisionParams)) {
      return;  // 条件不满足，不应用效果
    }
  }
  
  // 应用修改
  if (trait.effects.modifications && trait.effects.modifications.length > 0) {
    applyModifications(trait.effects.modifications, decisionParams);
  }
}

/**
 * 检查词条条件是否满足
 * @param {Array} conditions - 条件数组
 * @param {Object} decisionParams - 决策参数对象
 * @returns {boolean} 是否满足所有条件
 */
function checkTraitConditions(conditions, decisionParams) {
  for (const condition of conditions) {
    if (!checkSingleCondition(condition, decisionParams)) {
      return false;
    }
  }
  return true;
}

/**
 * 检查单个条件
 * @param {Object} condition - 条件对象
 * @param {Object} decisionParams - 决策参数对象
 * @returns {boolean} 是否满足条件
 */
function checkSingleCondition(condition, decisionParams) {
  const { type, params, value } = condition;
  
  switch (type) {
    case 'gte':  // 大于等于
      return decisionParams[params] >= value;
      
    case 'lte':  // 小于等于
      return decisionParams[params] <= value;
      
    case 'eq':   // 等于
      return decisionParams[params] === value;
      
    case 'all_gte':  // 所有参数都大于等于
      return params.every(p => decisionParams[p] >= value);
      
    case 'all_lte':  // 所有参数都小于等于
      return params.every(p => decisionParams[p] <= value);
      
    case 'any_gte':  // 任意参数大于等于
      return params.some(p => decisionParams[p] >= value);
      
    case 'any_lte':  // 任意参数小于等于
      return params.some(p => decisionParams[p] <= value);
      
    case 'max':  // 是最大值的参数
      // 这个条件用于标记，实际判断在modifications中处理
      return true;
      
    case 'min':  // 是最小值的参数
      // 这个条件用于标记，实际判断在modifications中处理
      return true;
      
    default:
      console.warn('未知的条件类型:', type);
      return false;
  }
}

/**
 * 应用参数修改
 * @param {Array} modifications - 修改数组
 * @param {Object} decisionParams - 决策参数对象（会被修改）
 */
function applyModifications(modifications, decisionParams) {
  for (const mod of modifications) {
    const { param, change, mode } = mod;
    
    // 处理特殊参数名
    let targetParam = param;
    if (param === '$max') {
      // 找出最大值的参数
      targetParam = findMaxParam(decisionParams);
    } else if (param === '$min') {
      // 找出最小值的参数
      targetParam = findMinParam(decisionParams);
    } else if (param === '$random') {
      // 随机选择一个参数
      const paramKeys = Object.keys(decisionParams);
      targetParam = paramKeys[Math.floor(Math.random() * paramKeys.length)];
    }
    
    // 应用修改
    if (mode === 'set') {
      // 设置为指定值
      decisionParams[targetParam] = change;
    } else {
      // 默认为add模式：增加
      decisionParams[targetParam] = (decisionParams[targetParam] || 0) + change;
    }
    
    // 确保不为负数
    decisionParams[targetParam] = Math.max(0, decisionParams[targetParam]);
  }
}

/**
 * 找出最大值的参数（并列时随机选择一个）
 * @param {Object} params - 参数对象
 * @returns {string} 参数键
 */
function findMaxParam(params) {
  const entries = Object.entries(params);
  const maxValue = Math.max(...entries.map(([_, v]) => v));
  const maxParams = entries.filter(([_, v]) => v === maxValue).map(([k, _]) => k);
  return maxParams[Math.floor(Math.random() * maxParams.length)];
}

/**
 * 找出最小值的参数（并列时随机选择一个）
 * @param {Object} params - 参数对象
 * @returns {string} 参数键
 */
function findMinParam(params) {
  const entries = Object.entries(params);
  const minValue = Math.min(...entries.map(([_, v]) => v));
  const minParams = entries.filter(([_, v]) => v === minValue).map(([k, _]) => k);
  return minParams[Math.floor(Math.random() * minParams.length)];
}

/**
 * 应用词条效果到属性（旧版本 - 兼容性保留）
 * @param {Array} traits - 词条数组
 * @param {Object} baseAttributes - 基础属性
 * @returns {Object} 应用效果后的属性
 */
export function applyTraitEffects(traits, baseAttributes) {
  const result = { ...baseAttributes };
  
  traits.forEach(trait => {
    if (trait.effects && trait.effects.attributeBonus) {
      for (const [attr, bonus] of Object.entries(trait.effects.attributeBonus)) {
        if (result.hasOwnProperty(attr)) {
          result[attr] += bonus;
          // 限制在0-100之间
          result[attr] = Math.max(0, Math.min(100, result[attr]));
        }
      }
    }
  });

  return result;
}

/**
 * 获取词条的事件修饰符
 * @param {Array} traits - 词条数组
 * @returns {Array} 事件修饰符数组
 */
export function getTraitModifiers(traits) {
  const modifiers = [];
  
  traits.forEach(trait => {
    if (trait.effects && trait.effects.eventModifier) {
      modifiers.push(...trait.effects.eventModifier);
    }
  });

  return modifiers;
}

/**
 * 获取稀有度对应的颜色类名
 * @param {string} rarity - 稀有度
 * @returns {string} Tailwind CSS类名
 */
export function getRarityColorClass(rarity) {
  const colorMap = {
    common: 'border-gray-400 bg-gray-100',
    rare: 'border-blue-600 bg-blue-50',
    epic: 'border-purple-600 bg-purple-50',
    legendary: 'border-amber-600 bg-amber-50'
  };
  return colorMap[rarity] || colorMap.common;
}

/**
 * 获取稀有度对应的文本颜色类名
 * @param {string} rarity - 稀有度
 * @returns {string} Tailwind CSS类名
 */
export function getRarityTextClass(rarity) {
  const colorMap = {
    common: 'text-gray-700',
    rare: 'text-blue-800',
    epic: 'text-purple-800',
    legendary: 'text-amber-800'
  };
  return colorMap[rarity] || colorMap.common;
}

/**
 * 获取稀有度标签的背景色类名
 * @param {string} rarity - 稀有度
 * @returns {string} Tailwind CSS类名
 */
export function getRarityBgClass(rarity) {
  const colorMap = {
    common: 'bg-gray-200',
    rare: 'bg-blue-200',
    epic: 'bg-purple-200',
    legendary: 'bg-amber-200'
  };
  return colorMap[rarity] || colorMap.common;
}

/**
 * 获取稀有度的中文名称
 * @param {string} rarity - 稀有度
 * @returns {string} 中文名称
 */
export function getRarityName(rarity) {
  const nameMap = {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说'
  };
  return nameMap[rarity] || '普通';
}