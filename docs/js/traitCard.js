/**
 * 词条卡片组件模块
 * 提供统一的词条卡片生成函数，确保各处显示格式一致
 */

import { getRarityColorClass, getRarityTextClass, getRarityName, getRarityBgClass } from './traitSystem.js';

/**
 * 创建词条卡片HTML
 * @param {Object} trait - 词条对象
 * @param {Object} options - 可选配置
 * @param {boolean} options.selectable - 是否可选择（默认true）
 * @param {boolean} options.selected - 是否已选中（默认false）
 * @param {string} options.cardClass - 额外的卡片类名（默认''）
 * @returns {string} HTML字符串
 */
export function createTraitCard(trait, options = {}) {
  const {
    selectable = true,
    selected = false,
    cardClass = ''
  } = options;
  
  const colorClass = getRarityColorClass(trait.rarity);
  const textClass = getRarityTextClass(trait.rarity);
  const bgClass = getRarityBgClass(trait.rarity);
  const rarityName = getRarityName(trait.rarity);
  
  // 选中状态的样式：改变背景色为蓝色，添加缩放和亮度提升
  const selectedBgClass = selected ? 'bg-blue-100 brightness-110 scale-105' : 'bg-white';
  const cursorClass = selectable ? 'cursor-pointer' : '';
  
  return `
    <div class="trait-card ${selectedBgClass} rounded-lg shadow-md p-2 hover:shadow-lg transition-all duration-300 border-2 ${colorClass} ${cursorClass} ${cardClass}" data-trait-id="${trait.id}">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold ${textClass} px-2 py-1 rounded-md ${bgClass} whitespace-nowrap">${rarityName}</span>
        <h3 class="text-sm font-bold text-gray-800 whitespace-nowrap">${trait.name}</h3>
        <span class="text-xs text-gray-600 truncate">${trait.description}</span>
      </div>
    </div>
  `;
}

/**
 * 创建词条卡片DOM元素
 * @param {Object} trait - 词条对象
 * @param {Object} options - 可选配置
 * @returns {HTMLElement} DOM元素
 */
export function createTraitCardElement(trait, options = {}) {
  const div = document.createElement('div');
  div.innerHTML = createTraitCard(trait, options);
  return div.firstElementChild;
}

/**
 * 更新词条卡片的选中状态
 * @param {HTMLElement} cardElement - 卡片DOM元素
 * @param {boolean} selected - 是否选中
 */
export function updateTraitCardSelection(cardElement, selected) {
  if (selected) {
    cardElement.classList.remove('bg-white');
    cardElement.classList.add('bg-blue-100', 'brightness-110', 'scale-105');
  } else {
    cardElement.classList.remove('bg-blue-100', 'brightness-110', 'scale-105');
    cardElement.classList.add('bg-white');
  }
}
