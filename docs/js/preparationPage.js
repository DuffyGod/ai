/**
 * 准备阶段UI模块
 * 负责渲染词条抽取、选择和属性分配界面
 */

import { getRarityColorClass, getRarityTextClass, getRarityName } from './traitSystem.js';
import { createAllocationControl, ATTRIBUTE_NAMES } from './attributeSystem.js';

/**
 * 渲染词条抽取界面（10连抽）
 * @param {Function} onDraw - 抽取词条的回调函数
 */
export function renderTraitDrawPage(onDraw) {
  const container = document.getElementById('app');
  
  container.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div class="max-w-2xl w-full">
        <div class="bg-white rounded-lg shadow-xl p-8 md:p-12 text-center">
          <h1 class="text-3xl font-bold text-gray-800 mb-4">准备阶段</h1>
          <p class="text-lg text-gray-600 mb-8">抽取词条，定义你的AI特性</p>
          
          <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-8 border-2 border-blue-200">
            <h2 class="text-xl font-bold text-gray-800 mb-2">10连抽</h2>
            <p class="text-gray-600">点击按钮抽取10个随机词条</p>
          </div>
          
          <button id="draw-traits-btn" class="w-full bg-gradient-to-r from-blue-800 to-blue-700 text-white text-lg font-bold py-4 px-8 rounded-md hover:from-blue-900 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg">
            开始抽取
          </button>
        </div>
      </div>
    </div>
  `;
  
  const drawBtn = document.getElementById('draw-traits-btn');
  if (drawBtn) {
    drawBtn.addEventListener('click', () => {
      drawBtn.disabled = true;
      drawBtn.textContent = '抽取中...';
      setTimeout(() => {
        onDraw();
      }, 500);
    });
  }
}

/**
 * 渲染词条选择界面
 * @param {Array} traits - 抽取的词条数组
 * @param {Function} onConfirm - 确认选择的回调函数
 */
export function renderTraitSelectPage(traits, onConfirm) {
  const container = document.getElementById('app');
  
  container.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 py-8">
      <div class="max-w-4xl mx-auto">
        <!-- 标题区 -->
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6 text-center">
          <h1 class="text-2xl font-bold text-gray-800 mb-2">选择词条</h1>
          <p class="text-gray-600">从10个词条中选择3个作为AI的核心特性</p>
          <div class="mt-4">
            <span class="text-lg font-bold text-blue-700">已选择: <span id="selected-count">0</span> / 3</span>
          </div>
        </div>
        
        <!-- 词条网格 -->
        <div class="grid grid-cols-1 gap-2 mb-6 max-w-3xl mx-auto" id="traits-grid">
          ${traits.map(trait => createTraitCard(trait)).join('')}
        </div>
        
        <!-- 确认按钮 -->
        <div class="text-center">
          <button id="confirm-traits-btn" disabled class="bg-gradient-to-r from-blue-800 to-blue-700 text-white text-lg font-bold py-4 px-12 rounded-md hover:from-blue-900 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
            确认选择
          </button>
        </div>
      </div>
    </div>
  `;
  
  // 选中状态管理
  let selectedTraits = [];
  
  // 计算两个元素之间的距离
  function getDistance(element1, element2) {
    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();
    const centerX1 = rect1.left + rect1.width / 2;
    const centerY1 = rect1.top + rect1.height / 2;
    const centerX2 = rect2.left + rect2.width / 2;
    const centerY2 = rect2.top + rect2.height / 2;
    return Math.sqrt(Math.pow(centerX2 - centerX1, 2) + Math.pow(centerY2 - centerY1, 2));
  }
  
  // 绑定词条卡片点击事件
  const traitCards = document.querySelectorAll('.trait-card');
  traitCards.forEach(card => {
    card.addEventListener('click', (event) => {
      const traitId = card.dataset.traitId;
      const trait = traits.find(t => t.id === traitId);
      
      if (card.classList.contains('selected')) {
        // 取消选择
        card.classList.remove('selected', 'ring-4', 'ring-blue-600', 'bg-blue-200');
        selectedTraits = selectedTraits.filter(t => t.id !== traitId);
      } else {
        // 选择
        if (selectedTraits.length < 3) {
          card.classList.add('selected', 'ring-4', 'ring-blue-600', 'bg-blue-200');
          selectedTraits.push(trait);
        } else {
          // 已选中3个，找出距离最远的词条并取消选中
          let maxDistance = -1;
          let farthestCard = null;
          let farthestTrait = null;
          
          selectedTraits.forEach(selectedTrait => {
            const selectedCard = document.querySelector(`.trait-card[data-trait-id="${selectedTrait.id}"]`);
            if (selectedCard) {
              const distance = getDistance(card, selectedCard);
              if (distance > maxDistance) {
                maxDistance = distance;
                farthestCard = selectedCard;
                farthestTrait = selectedTrait;
              }
            }
          });
          
          // 取消距离最远的词条
          if (farthestCard && farthestTrait) {
            farthestCard.classList.remove('selected', 'ring-4', 'ring-blue-600', 'bg-blue-200');
            selectedTraits = selectedTraits.filter(t => t.id !== farthestTrait.id);
          }
          
          // 选中新词条
          card.classList.add('selected', 'ring-4', 'ring-blue-600', 'bg-blue-200');
          selectedTraits.push(trait);
        }
      }
      
      // 更新计数
      document.getElementById('selected-count').textContent = selectedTraits.length;
      
      // 更新确认按钮状态
      const confirmBtn = document.getElementById('confirm-traits-btn');
      confirmBtn.disabled = selectedTraits.length !== 3;
    });
  });
  
  // 绑定确认按钮
  const confirmBtn = document.getElementById('confirm-traits-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (selectedTraits.length === 3) {
        onConfirm(selectedTraits);
      }
    });
  }
}

/**
 * 创建词条卡片HTML
 * @param {Object} trait - 词条对象
 * @returns {string} HTML字符串
 */
function createTraitCard(trait) {
  const colorClass = getRarityColorClass(trait.rarity);
  const textClass = getRarityTextClass(trait.rarity);
  const rarityName = getRarityName(trait.rarity);
  
  return `
    <div class="trait-card bg-white rounded-lg shadow-md p-2 cursor-pointer hover:shadow-lg transition-all duration-300 border-2 ${colorClass}" data-trait-id="${trait.id}">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold ${textClass} px-2 py-1 rounded-md bg-white whitespace-nowrap">${rarityName}</span>
        <h3 class="text-sm font-bold text-gray-800 whitespace-nowrap">${trait.name}</h3>
        <span class="text-xs text-gray-600 truncate">${trait.description}</span>
      </div>
    </div>
  `;
}

/**
 * 渲染属性分配界面
 * @param {Object} baseAttributes - 基础属性
 * @param {Function} onConfirm - 确认分配的回调函数
 */
export function renderAttributeAllocationPage(baseAttributes, onConfirm) {
  const container = document.getElementById('app');
  
  // 初始化分配状态
  const allocation = {
    efficiency: 0,
    cognition: 0,
    controllability: 0,
    adaptability: 0,
    explainability: 0
  };
  
  let remainingPoints = 10;
  
  container.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 py-6">
      <div class="max-w-3xl mx-auto">
        <!-- 标题区 -->
        <div class="bg-white rounded-lg shadow-lg p-4 mb-4 text-center">
          <h1 class="text-2xl font-bold text-gray-800 mb-1">决策点数分配</h1>
          <p class="text-sm text-gray-600 mb-3">分配10个决策点数，影响后续事件的发展方向和结果</p>
          <div class="inline-block bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg px-4 py-2 border-2 border-blue-200">
            <span class="text-sm text-gray-700">剩余点数: </span>
            <span id="remaining-points" class="text-2xl font-bold text-blue-700">10</span>
          </div>
        </div>
        
        <!-- 属性分配网格 -->
        <div class="grid grid-cols-1 gap-3 mb-4 max-w-2xl mx-auto" id="allocation-grid">
          ${Object.keys(ATTRIBUTE_NAMES).map(key => 
            createCompactAllocationControl(key, 0)
          ).join('')}
        </div>
        
        <!-- 按钮区 -->
        <div class="flex gap-3 justify-center">
          <button id="random-allocation-btn" class="bg-gradient-to-r from-amber-600 to-orange-600 text-white text-base font-bold py-3 px-8 rounded-md hover:from-amber-700 hover:to-orange-700 transition-all duration-300 shadow-md hover:shadow-lg">
            随机分配
          </button>
          <button id="confirm-allocation-btn" disabled class="bg-gradient-to-r from-blue-800 to-blue-700 text-white text-base font-bold py-3 px-8 rounded-md hover:from-blue-900 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
            开始体验
          </button>
        </div>
        <p class="text-gray-300 text-xs text-center mt-2">请分配完所有点数后开始</p>
      </div>
    </div>
  `;
  
  // 随机分配函数
  function randomAllocate() {
    // 如果有剩余点数，只分配剩余的；否则重新分配所有点数
    const pointsToAllocate = remainingPoints > 0 ? remainingPoints : 10;
    
    if (remainingPoints === 0) {
      // 重置所有分配
      Object.keys(allocation).forEach(key => {
        allocation[key] = 0;
      });
      remainingPoints = 10;
    }
    
    // 随机分配点数
    const attrs = Object.keys(allocation);
    let remaining = pointsToAllocate;
    
    while (remaining > 0) {
      const randomAttr = attrs[Math.floor(Math.random() * attrs.length)];
      allocation[randomAttr]++;
      remaining--;
    }
    
    remainingPoints = 0;
    updateUI();
  }
  
  // 更新UI函数
  function updateUI() {
    document.getElementById('remaining-points').textContent = remainingPoints;
    
    // 更新所有属性显示
    Object.keys(allocation).forEach(key => {
      const valueEl = document.querySelector(`.allocation-value[data-attr="${key}"]`);
      if (valueEl) {
        valueEl.textContent = allocation[key];
      }
      
      // 更新按钮状态
      const minusBtn = document.querySelector(`.allocation-btn-minus[data-attr="${key}"]`);
      const plusBtn = document.querySelector(`.allocation-btn-plus[data-attr="${key}"]`);
      
      if (minusBtn) {
        minusBtn.disabled = allocation[key] <= 0;
      }
      if (plusBtn) {
        plusBtn.disabled = remainingPoints <= 0;
      }
    });
    
    // 更新确认按钮
    const confirmBtn = document.getElementById('confirm-allocation-btn');
    confirmBtn.disabled = remainingPoints !== 0;
  }
  
  // 绑定加号按钮
  document.querySelectorAll('.allocation-btn-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const attr = btn.dataset.attr;
      if (remainingPoints > 0) {
        allocation[attr]++;
        remainingPoints--;
        updateUI();
      }
    });
  });
  
  // 绑定减号按钮
  document.querySelectorAll('.allocation-btn-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const attr = btn.dataset.attr;
      if (allocation[attr] > 0) {
        allocation[attr]--;
        remainingPoints++;
        updateUI();
      }
    });
  });
  
  // 绑定随机分配按钮
  const randomBtn = document.getElementById('random-allocation-btn');
  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      randomAllocate();
    });
  }
  
  // 绑定确认按钮
  const confirmBtn = document.getElementById('confirm-allocation-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      if (remainingPoints === 0) {
        onConfirm(allocation);
      }
    });
  }
}

/**
 * 创建紧凑的属性分配控件HTML（不显示属性值）
 * @param {string} key - 属性键
 * @param {number} allocatedPoints - 已分配点数
 * @returns {string} HTML字符串
 */
function createCompactAllocationControl(key, allocatedPoints) {
  const name = ATTRIBUTE_NAMES[key] || key;
  
  return `
    <div class="bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors">
      <div class="flex justify-between items-center mb-2">
        <h4 class="text-sm font-bold text-gray-800">${name}</h4>
      </div>
      <div class="flex items-center gap-2">
        <button class="allocation-btn-minus w-7 h-7 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm" 
                data-attr="${key}" 
                ${allocatedPoints <= 0 ? 'disabled' : ''}>
          -
        </button>
        <div class="flex-1 text-center">
          <span class="text-xl font-bold text-blue-700 allocation-value" data-attr="${key}">${allocatedPoints}</span>
          <span class="text-xs text-gray-500 ml-1">点</span>
        </div>
        <button class="allocation-btn-plus w-7 h-7 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm" 
                data-attr="${key}">
          +
        </button>
      </div>
    </div>
  `;
}
