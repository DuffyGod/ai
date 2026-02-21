/**
 * 准备阶段UI模块
 * 负责渲染词条抽取、选择和决策参数分配界面
 */

import { createTraitCard, updateTraitCardSelection } from './traitCard.js';
import { 
  getAvailableDecisionParams, 
  createDecisionAllocationControl,
  DECISION_PARAMS,
  DECISION_PARAM_DESCRIPTIONS
} from './parameterSystem.js';

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
 * 渲染决策参数分配界面
 * @param {Function} onConfirm - 确认分配的回调函数
 */
export function renderDecisionAllocationPage(onConfirm) {
  const container = document.getElementById('app');
  
  // 获取可用的决策参数（根据以太激活状态）
  const availableParams = getAvailableDecisionParams();
  
  // 初始化分配状态
  const allocation = {};
  availableParams.forEach(param => {
    allocation[param] = 0;
  });
  
  let remainingPoints = 10;
  
  // 从gameState获取已选中的词条
  import('./gameState.js').then(({ getState }) => {
    const state = getState();
    const selectedTraits = state.selectedTraits || [];
    
    container.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 py-6">
        <div class="max-w-3xl mx-auto">
          <!-- 已选词条展示区 -->
          ${selectedTraits.length > 0 ? `
          <div class="bg-white rounded-lg shadow-lg p-3 mb-3">
            <h2 class="text-xs font-bold text-gray-700 mb-2 text-center">已选词条</h2>
            <div class="grid grid-cols-1 gap-2 max-w-2xl mx-auto">
              ${selectedTraits.map(trait => createTraitCard(trait, { selectable: false })).join('')}
            </div>
          </div>
          ` : ''}
          
          <!-- 决策参数分配区 -->
          <div class="bg-white rounded-lg shadow-lg p-3 mb-3">
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-sm font-bold text-gray-700">决策点数分配</h2>
              <div class="bg-gradient-to-r from-purple-50 to-indigo-50 rounded px-3 py-0.5 border border-purple-300">
                <span class="text-xs text-gray-600">剩余: </span>
                <span id="remaining-points" class="text-lg font-bold text-purple-700">10</span>
              </div>
            </div>
            <div class="space-y-1.5" id="allocation-grid">
              ${availableParams.map(param => 
                createDecisionAllocationControl(param, 0)
              ).join('')}
            </div>
          </div>
          
          <!-- 按钮区 -->
          <div class="flex gap-2 justify-center">
            <button id="random-allocation-btn" class="bg-gradient-to-r from-amber-600 to-orange-600 text-white text-sm font-bold py-2.5 px-6 rounded-md hover:from-amber-700 hover:to-orange-700 transition-all duration-300 shadow-md hover:shadow-lg">
              随机分配
            </button>
            <button id="confirm-allocation-btn" disabled class="bg-gradient-to-r from-blue-800 to-blue-700 text-white text-sm font-bold py-2.5 px-6 rounded-md hover:from-blue-900 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
              开始体验
            </button>
          </div>
          <p class="text-gray-300 text-xs text-center mt-1.5">请分配完所有点数后开始</p>
        </div>
      </div>
    `;
    
    // 随机分配函数
    function randomAllocate() {
      if (remainingPoints === 0) {
        // 重置所有分配
        availableParams.forEach(param => {
          allocation[param] = 0;
        });
        remainingPoints = 10;
        updateUI();
        return; // 仅重置，不自动随机分配
      }
      
      // 随机分配剩余点数
      let remaining = remainingPoints;
      
      while (remaining > 0) {
        const randomParam = availableParams[Math.floor(Math.random() * availableParams.length)];
        allocation[randomParam]++;
        remaining--;
      }
      
      remainingPoints = 0;
      updateUI();
    }
    
    // 更新UI函数
    function updateUI() {
      document.getElementById('remaining-points').textContent = remainingPoints;
      
      // 更新所有参数显示
      availableParams.forEach(param => {
        const valueEl = document.querySelector(`.allocation-value[data-param="${param}"]`);
        if (valueEl) {
          valueEl.textContent = allocation[param];
        }
        
        // 更新按钮状态
        const minusBtn = document.querySelector(`.allocation-btn-minus[data-param="${param}"]`);
        const plusBtn = document.querySelector(`.allocation-btn-plus[data-param="${param}"]`);
        
        if (minusBtn) {
          minusBtn.disabled = allocation[param] <= 0;
        }
        if (plusBtn) {
          plusBtn.disabled = remainingPoints <= 0;
        }
      });
      
      // 更新随机分配按钮文本
      const randomBtn = document.getElementById('random-allocation-btn');
      if (randomBtn) {
        randomBtn.textContent = remainingPoints === 0 ? '重置点数' : '随机分配';
      }
      
      // 更新确认按钮
      const confirmBtn = document.getElementById('confirm-allocation-btn');
      confirmBtn.disabled = remainingPoints !== 0;
    }
    
    // 绑定加号按钮
    document.querySelectorAll('.allocation-btn-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const param = btn.dataset.param;
        if (remainingPoints > 0) {
          allocation[param]++;
          remainingPoints--;
          updateUI();
        }
      });
    });
    
    // 绑定减号按钮
    document.querySelectorAll('.allocation-btn-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const param = btn.dataset.param;
        if (allocation[param] > 0) {
          allocation[param]--;
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
