/**
 * 体验阶段UI模块
 * 负责渲染游戏体验阶段和结局界面
 */

import { formatAttributeDisplay } from './attributeSystem.js';
import { formatAssetsChange, formatAttributeChanges } from './eventSystem.js';
import { getRarityColorClass, getRarityName, getRarityTextClass } from './traitSystem.js';

// 用于跟踪是否已经初始化页面
let isPageInitialized = false;
let lastEventCount = 0;

/**
 * 渲染体验阶段界面
 * @param {Object} state - 游戏状态
 * @param {Function} onNextTurn - 下一回合的回调函数
 */
export function renderExperiencePage(state, onNextTurn) {
  const container = document.getElementById('app');
  
  // 检查是否游戏结束
  const isGameOver = state.isGameOver;
  const endingEvent = isGameOver && state.eventHistory.length > 0 ? 
    state.eventHistory[state.eventHistory.length - 1] : null;
  
  // 如果页面未初始化或游戏结束，进行完整渲染
  if (!isPageInitialized || isGameOver) {
    container.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <!-- 顶部信息栏 -->
        <div id="top-info-bar" class="bg-gradient-to-r from-slate-800 to-slate-700 shadow-lg sticky top-0 z-10">
          <div class="max-w-7xl mx-auto px-4 py-2">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <!-- 回合和资产 -->
              <div class="flex items-center gap-4">
                <div>
                  <span class="text-xs text-gray-300">回合</span>
                  <div id="turn-display" class="text-lg font-bold text-blue-400">${state.turn}</div>
                </div>
                <div>
                  <span class="text-xs text-gray-300">资产</span>
                  <div id="assets-display" class="text-lg font-bold ${state.assets >= 0 ? 'text-green-400' : 'text-red-400'}">${state.assets}</div>
                </div>
              </div>
              
              <!-- 属性显示 -->
              <div id="attributes-display" class="flex flex-wrap gap-3">
                ${Object.entries(state.attributes).map(([key, value]) => {
                  const allocatedPoints = state.allocatedPoints?.[key] || 0;
                  return `
                  <div class="text-center">
                    <div class="text-xs text-gray-300">
                      ${getAttributeShortName(key)}${allocatedPoints > 0 ? `<span class="text-purple-400 ml-1">(+${allocatedPoints})</span>` : ''}
                    </div>
                    <div class="text-sm font-bold ${getAttributeColorByValue(value)}">
                      ${value}
                    </div>
                  </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 主体内容区 -->
        <div class="max-w-4xl mx-auto p-4 py-4">
          <!-- 提示信息 -->
          <div id="hint-message" class="${!isGameOver ? '' : 'hidden'}">
            <div class="bg-white/90 backdrop-blur rounded-lg shadow-md p-3 mb-3 text-center">
              <p class="text-sm text-gray-700">
                <span class="font-bold text-blue-700">点击屏幕任意位置</span> 推进回合
              </p>
            </div>
          </div>
          
          <!-- 事件记录区 -->
          <div id="events-container" class="space-y-2">
            ${state.eventHistory.length === 0 ? `
              <div class="bg-white/80 backdrop-blur rounded-lg shadow-md p-6 text-center">
                <p class="text-lg text-gray-600">你的AI产品即将开始它的旅程...</p>
                <p class="text-xs text-gray-500 mt-2">点击屏幕开始第一个回合</p>
              </div>
            ` : state.eventHistory.filter(e => e.type !== 'ending').map(event => createEventCard(event)).join('')}
            
            ${isGameOver && endingEvent ? createEndingEventCard(endingEvent, state) : ''}
          </div>
        </div>
      </div>
    `;
    
    isPageInitialized = true;
    lastEventCount = state.eventHistory.filter(e => e.type !== 'ending').length;
  } else {
    // 增量更新：只更新变化的部分
    updateTopBar(state);
    updateEventsList(state);
  }
  
  // 绑定点击事件（点击任意位置推进回合）
  if (!isGameOver) {
    document.body.style.cursor = 'pointer';
    const clickHandler = (e) => {
      // 避免重复触发
      document.body.style.cursor = 'default';
      document.removeEventListener('click', clickHandler);
      
      onNextTurn();
    };
    
    // 延迟绑定，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', clickHandler);
    }, 100);
  } else {
    document.body.style.cursor = 'default';
  }
  
  // 如果游戏结束，绑定词条保留和返回按钮事件
  if (isGameOver) {
    bindEndingInteractions(state, onNextTurn);
  }
  
  // 自动滚动到最新事件
  setTimeout(() => {
    const eventsContainer = document.getElementById('events-container');
    if (eventsContainer && eventsContainer.lastElementChild) {
      eventsContainer.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 100);
}

/**
 * 更新顶部信息栏（增量更新）
 * @param {Object} state - 游戏状态
 */
function updateTopBar(state) {
  // 更新回合数
  const turnDisplay = document.getElementById('turn-display');
  if (turnDisplay) {
    turnDisplay.textContent = state.turn;
  }
  
  // 更新资产
  const assetsDisplay = document.getElementById('assets-display');
  if (assetsDisplay) {
    assetsDisplay.textContent = state.assets;
    assetsDisplay.className = `text-lg font-bold ${state.assets >= 0 ? 'text-green-400' : 'text-red-400'}`;
  }
  
  // 更新属性显示
  const attributesDisplay = document.getElementById('attributes-display');
  if (attributesDisplay) {
    attributesDisplay.innerHTML = Object.entries(state.attributes).map(([key, value]) => {
      const allocatedPoints = state.allocatedPoints?.[key] || 0;
      return `
      <div class="text-center">
        <div class="text-xs text-gray-300">
          ${getAttributeShortName(key)}${allocatedPoints > 0 ? `<span class="text-purple-400 ml-1">(+${allocatedPoints})</span>` : ''}
        </div>
        <div class="text-sm font-bold ${getAttributeColorByValue(value)}">
          ${value}
        </div>
      </div>
      `;
    }).join('');
  }
}

/**
 * 更新事件列表（增量更新）
 * @param {Object} state - 游戏状态
 */
function updateEventsList(state) {
  const eventsContainer = document.getElementById('events-container');
  if (!eventsContainer) return;
  
  const normalEvents = state.eventHistory.filter(e => e.type !== 'ending');
  const currentEventCount = normalEvents.length;
  
  // 只添加新事件
  if (currentEventCount > lastEventCount) {
    const newEvents = normalEvents.slice(lastEventCount);
    newEvents.forEach(event => {
      const eventElement = document.createElement('div');
      eventElement.innerHTML = createEventCard(event);
      eventsContainer.appendChild(eventElement.firstElementChild);
    });
    lastEventCount = currentEventCount;
    
    // 隐藏初始提示（如果有事件了）
    hideInitialHint();
  }
}

/**
 * 隐藏初始提示
 */
function hideInitialHint() {
  const eventsContainer = document.getElementById('events-container');
  if (eventsContainer) {
    // 移除初始提示卡片
    const initialCard = eventsContainer.querySelector('.text-lg');
    if (initialCard && initialCard.parentElement) {
      initialCard.parentElement.style.display = 'none';
    }
  }
}

/**
 * 重置页面状态（用于返回主菜单时）
 */
export function resetExperiencePage() {
  isPageInitialized = false;
  lastEventCount = 0;
}

/**
 * 创建事件卡片HTML（紧凑版）
 * @param {Object} event - 事件对象
 * @returns {string} HTML字符串
 */
function createEventCard(event) {
  const effects = event.effects || {};
  const assetsChange = effects.assetsChange || 0;
  const attributeChanges = effects.attributeChanges || {};
  
  // 构建效果文本
  let effectsText = '';
  if (assetsChange !== 0 || Object.keys(attributeChanges).length > 0) {
    const parts = [];
    if (assetsChange !== 0) {
      const sign = assetsChange > 0 ? '+' : '';
      const color = assetsChange > 0 ? 'text-green-600' : 'text-red-600';
      parts.push(`<span class="${color}">资产${sign}${assetsChange}</span>`);
    }
    if (Object.keys(attributeChanges).length > 0) {
      parts.push(formatAttributeChanges(attributeChanges));
    }
    effectsText = ` [${parts.join(' ')}]`;
  }
  
  return `
    <div class="bg-white rounded-lg shadow-md p-3 hover:shadow-lg transition-shadow duration-200 animate-fadeIn">
      <p class="text-sm text-gray-700 leading-relaxed">
        <span class="font-bold text-blue-700">第${event.turn}回合：</span>${event.description}${effectsText}
      </p>
    </div>
  `;
}

/**
 * 创建保留词条卡片（与选择界面格式一致）
 * @param {Object} trait - 词条对象
 * @returns {string} HTML字符串
 */
function createReserveTraitCard(trait) {
  const colorClass = getRarityColorClass(trait.rarity);
  const rarityName = getRarityName(trait.rarity);
  const textClass = getRarityTextClass(trait.rarity);
  
  return `
    <div class="reserve-trait-card bg-white rounded-lg shadow-md p-2 cursor-pointer hover:shadow-lg transition-all duration-300 border-2 ${colorClass}" data-trait-id="${trait.id}">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold ${textClass} px-2 py-1 rounded-md bg-white whitespace-nowrap">${rarityName}</span>
        <h3 class="text-sm font-bold text-gray-800 whitespace-nowrap">${trait.name}</h3>
        <span class="text-xs text-gray-600 truncate">${trait.description}</span>
      </div>
    </div>
  `;
}

/**
 * 获取属性简称
 */
function getAttributeShortName(key) {
  const names = {
    efficiency: '效率',
    cognition: '认知',
    controllability: '可控',
    adaptability: '适应',
    explainability: '解释'
  };
  return names[key] || key;
}

/**
 * 根据属性值获取颜色
 */
function getAttributeColorByValue(value) {
  if (value >= 70) return 'text-green-400';
  if (value >= 50) return 'text-blue-400';
  if (value >= 30) return 'text-yellow-400';
  return 'text-red-400';
}

/**
 * 创建结局事件卡片（整合在事件流中）
 * @param {Object} endingEvent - 结局事件对象
 * @param {Object} state - 游戏状态
 * @returns {string} HTML字符串
 */
function createEndingEventCard(endingEvent, state) {
  return `
    <div class="bg-gradient-to-r from-indigo-900 to-blue-900 border-4 border-indigo-600 rounded-lg p-4 mt-4 animate-fadeIn">
      <!-- 结局标题 -->
      <div class="mb-3">
        <h3 class="text-2xl font-bold text-white">${endingEvent.name}</h3>
      </div>
      
      <!-- 结局描述 -->
      <p class="text-gray-200 text-base leading-relaxed mb-4">${endingEvent.description}</p>
      
      <!-- 词条保留区 -->
      <div class="border-t-2 border-indigo-500 pt-4 mt-4">
        <h4 class="text-base font-bold text-white mb-2">保留一个词条用于下一局</h4>
        <p class="text-xs text-gray-300 mb-3">选择一个词条，它将在下次游戏的10连抽中必定出现</p>
        <div class="grid grid-cols-1 gap-2 mb-4 max-w-2xl mx-auto" id="ending-reserve-traits-grid">
          ${state.selectedTraits.map(trait => createReserveTraitCard(trait)).join('')}
        </div>
        
        <!-- 返回按钮 -->
        <button id="ending-return-btn" class="w-full bg-gradient-to-r from-blue-800 to-blue-700 text-white text-base font-bold py-3 px-6 rounded-md hover:from-blue-900 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg">
          返回主菜单
        </button>
        <p class="text-xs text-gray-300 text-center mt-2">也可以不保留词条直接返回</p>
      </div>
    </div>
  `;
}

/**
 * 绑定结局界面的交互事件
 * @param {Object} state - 游戏状态
 * @param {Function} onReturn - 返回回调（实际上会传递保留词条）
 */
function bindEndingInteractions(state, onReturn) {
  let reservedTrait = null;
  
  // 绑定词条卡片点击事件
  const traitCards = document.querySelectorAll('.reserve-trait-card');
  traitCards.forEach(card => {
    card.addEventListener('click', () => {
      const traitId = card.dataset.traitId;
      const trait = state.selectedTraits.find(t => t.id === traitId);
      
      // 检查是否点击的是已选中的卡片（取消选中）
      const isCurrentlySelected = card.classList.contains('ring-4');
      
      // 取消所有选中状态
      traitCards.forEach(c => {
        c.classList.remove('ring-4', 'ring-blue-600', 'bg-blue-200');
        c.style.transform = '';
      });
      
      if (isCurrentlySelected) {
        // 取消选中
        reservedTrait = null;
      } else {
        // 选中当前卡片，使用与词条选择界面完全一致的样式
        card.classList.add('ring-4', 'ring-blue-600', 'bg-blue-200');
        reservedTrait = trait;
      }
    });
  });
  
  // 绑定返回按钮
  const returnBtn = document.getElementById('ending-return-btn');
  if (returnBtn) {
    returnBtn.addEventListener('click', () => {
      // 需要调用main.js中的returnToLanding方法
      // 由于架构限制，这里通过window对象传递
      if (window.game && window.game.returnToLanding) {
        window.game.returnToLanding(reservedTrait);
      }
    });
  }
}
