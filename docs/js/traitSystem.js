/**
 * 词条系统模块
 * 负责词条的抽取、选择和效果应用
 */

import { getReservedTrait } from './gameState.js';

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
 * 应用词条效果到属性
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
    epic: 'border-indigo-600 bg-indigo-50',
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
    epic: 'text-indigo-800',
    legendary: 'text-amber-800'
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