/**
 * 准备阶段UI模块
 * 负责渲染词条抽取、选择和属性分配界面
 */

import { createTraitCard, updateTraitCardSelection } from './traitCard.js';
import { createAllocationControl, ATTRIBUTE_NAMES } from './attributeSystem.js';

/**
 * 渲染词条抽取界面（10连抽）
 * @param {Function} onDraw - 抽取词条的回调函数
 */
export function renderTraitDrawPage(onDraw) {
  const container = document.getElementById('app');
  
  container.innerHTML = `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <button id="draw-traits-btn" class="w-64 h-64 rounded-full bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white text-3xl font-bold shadow-2xl hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border-4 border-blue-400 hover:border-blue-300">
        10连抽
      </button>
    </div>
  `;
  
  const drawBtn = document.getElementById('draw-traits-btn');
  if (drawBtn) {
    drawBtn.addEventListener('click', () => {
      onDraw();
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
  
  // 添加逐个出现的动画效果
  const traitCards = document.querySelectorAll('.trait-card');
  traitCards.forEach((card, index) => {
    // 设置初始状态：透明且向下偏移
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
    
    // 逐个显示卡片
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
      
      // 动画完成后恢复正常的transition，保留选中时的放大效果
      setTimeout(() => {
        card.style.opacity = '';
        card.style.transform = '';
        card.style.transition = '';
      }, 400);
    }, index * 50); // 每个卡片延迟50ms
  });
  
  // 绑定词条卡片点击事件
  traitCards.forEach(card => {
    card.addEventListener('click', (event) => {
      const traitId = card.dataset.traitId;
      const trait = traits.find(t => t.id === traitId);
      
      // 使用正确的类名判断选中状态
      const isSelected = card.classList.contains('bg-blue-100');
      
      if (isSelected) {
        // 取消选择
        updateTraitCardSelection(card, false);
        selectedTraits = selectedTraits.filter(t => t.id !== traitId);
      } else {
        // 选择
        if (selectedTraits.length < 3) {
          updateTraitCardSelection(card, true);
          selectedTraits.push(trait);
        } else {
          // 已选中3个，替换第一个选中的词条
          const firstSelectedTrait = selectedTraits[0];
          const firstSelectedCard = document.querySelector(`.trait-card[data-trait-id="${firstSelectedTrait.id}"]`);
          
          if (firstSelectedCard) {
            updateTraitCardSelection(firstSelectedCard, false);
          }
          
          selectedTraits.shift(); // 移除第一个
          
          // 选中新词条
          updateTraitCardSelection(card, true);
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
  
  // 从gameState获取已选中的词条
  import('./gameState.js').then(({ getState }) => {
    const state = getState();
    const selectedTraits = state.selectedTraits || [];
    
    container.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 py-6">
        <div class="max-w-4xl mx-auto">
          <!-- 标题区 -->
          <div class="bg-white rounded-lg shadow-lg p-4 mb-4 text-center">
            <h1 class="text-2xl font-bold text-gray-800 mb-1">决策点数分配</h1>
            <p class="text-sm text-gray-600">分配10个决策点数，影响后续事件的发展方向和结果</p>
          </div>
          
          <!-- 已选词条展示区 -->
          ${selectedTraits.length > 0 ? `
          <div class="bg-white rounded-lg shadow-lg p-4 mb-4">
            <h2 class="text-sm font-bold text-gray-700 mb-3 text-center">已选词条</h2>
            <div class="grid grid-cols-1 gap-2 max-w-3xl mx-auto">
              ${selectedTraits.map(trait => createTraitCard(trait, { selectable: false })).join('')}
            </div>
          </div>
          ` : ''}
          
          <!-- 属性分配网格（包含剩余点数） -->
          <div class="bg-white rounded-lg shadow-lg p-4 mb-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-bold text-gray-700">决策点数分配</h2>
              <div class="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg px-4 py-1 border-2 border-purple-300">
                <span class="text-xs text-gray-600">剩余: </span>
                <span id="remaining-points" class="text-xl font-bold text-purple-700">10</span>
              </div>
            </div>
            <div class="space-y-2" id="allocation-grid">
              ${Object.keys(ATTRIBUTE_NAMES).map(key => 
                createOptimizedAllocationControl(key, 0)
              ).join('')}
            </div>
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
  });
}

/**
 * 创建优化的属性分配控件HTML（一行展示所有信息）
 * @param {string} key - 属性键
 * @param {number} allocatedPoints - 已分配点数
 * @returns {string} HTML字符串
 */
function createOptimizedAllocationControl(key, allocatedPoints) {
  const attributeNames = {
    efficiency: '效率与规模',
    cognition: '认知能力',
    controllability: '可控度',
    adaptability: '适应能力',
    explainability: '可解释性'
  };
  
  const attributeDescriptions = {
    efficiency: '处理任务的速度和可扩展性',
    cognition: '理解和推理的能力',
    controllability: '遵守规则和安全约束的程度',
    adaptability: '适应新场景和任务的能力',
    explainability: '解释决策过程的透明度'
  };
  
  const name = attributeNames[key] || key;
  const description = attributeDescriptions[key] || '';
  
  return `
    <div class="bg-gradient-to-r from-gray-50 to-blue-50 p-3 rounded-lg border border-gray-200 hover:border-purple-400 hover:shadow-md transition-all">
      <div class="flex items-center justify-between gap-3">
        <!-- 属性信息 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2">
            <h4 class="text-sm font-bold text-gray-800">${name}</h4>
            <p class="text-xs text-gray-500 truncate">${description}</p>
          </div>
        </div>
        
        <!-- 点数控制 -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <button class="allocation-btn-minus w-8 h-8 rounded-full bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center" 
                  data-attr="${key}" 
                  ${allocatedPoints <= 0 ? 'disabled' : ''}>
            −
          </button>
          <div class="w-12 text-center">
            <span class="text-2xl font-bold text-purple-600 allocation-value" data-attr="${key}">${allocatedPoints}</span>
          </div>
          <button class="allocation-btn-plus w-8 h-8 rounded-full bg-green-500 text-white hover:bg-green-600 active:scale-95 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center" 
                  data-attr="${key}">
            +
          </button>
        </div>
      </div>
    </div>
  `;
}
