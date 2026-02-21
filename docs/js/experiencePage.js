/**
 * 体验阶段UI模块
 * 负责渲染游戏体验阶段和结局界面
 */

import { formatParamChanges, DECISION_PARAMS } from './parameterSystem.js';
import { createTraitCard, updateTraitCardSelection } from './traitCard.js';

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
          <div class="max-w-7xl mx-auto px-4 py-4">
            <!-- 决策参数卡片（居中展示，加大宽度） -->
            <div class="flex justify-center gap-4">
              ${Object.entries(state.decisionParams).filter(([key]) => key !== 'ether' || state.etherActivated).map(([key, value]) => `
                <div class="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg px-6 py-3 shadow-md min-w-[100px]">
                  <div class="text-sm text-blue-100 text-center">${DECISION_PARAMS[key]}</div>
                  <div class="text-2xl font-bold text-white text-center">${value}</div>
                </div>
              `).join('')}
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
  // 完整重新渲染顶部栏
  const topBar = document.getElementById('top-info-bar');
  if (topBar) {
    topBar.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-4">
        <!-- 决策参数卡片（居中展示，加大宽度） -->
        <div class="flex justify-center gap-4">
          ${Object.entries(state.decisionParams).filter(([key]) => key !== 'ether' || state.etherActivated).map(([key, value]) => `
            <div class="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg px-6 py-3 shadow-md min-w-[100px]">
              <div class="text-sm text-blue-100 text-center">${DECISION_PARAMS[key]}</div>
              <div class="text-2xl font-bold text-white text-center">${value}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
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
  
  // 不再显示读取参数标签
  let readParamsHtml = '';
  
  // 构建参数变化文本（每个参数使用独立的中括号）
  let effectsHtml = '';
  const changes = [];
  
  // 定义负面参数列表
  const negativeParams = ['regulation', 'anxiety'];
  
  // 遍历所有效果
  for (const [key, value] of Object.entries(effects.paramChanges || {})) {
    if (value !== 0) {
      const paramName = getParamDisplayName(key);
      const sign = value > 0 ? '+' : '';
      
      // 根据参数的正负面属性决定颜色
      let color;
      if (negativeParams.includes(key)) {
        // 负面参数：增加用红色，降低用绿色
        color = value > 0 ? 'text-red-600' : 'text-green-600';
      } else {
        // 正面参数：增加用绿色，降低用红色
        color = value > 0 ? 'text-green-600' : 'text-red-600';
      }
      
      changes.push(`<span class="${color}">[${paramName}${sign}${value}]</span>`);
    }
  }
  
  if (changes.length > 0) {
    effectsHtml = ` ${changes.join(' ')}`;
  }
  
  // 构建判断条件文本（统一展示，用颜色区分是否满足）
  let conditionsHtml = '';
  
  // 判定事件（judgment类型）：显示判定条件
  if (event.type === 'judgment' && event.condition) {
    const condition = event.condition;
    const paramName = getParamDisplayName(condition.param);
    const operatorSymbol = {
      'gte': '≥',
      'lte': '≤',
      'gt': '>',
      'lt': '<',
      'eq': '='
    }[condition.operator] || '?';
    
    // 根据是否通过判定决定颜色：通过为绿色，未通过为灰色
    const colorClass = event.isPassed ? 'text-green-600' : 'text-gray-400';
    
    conditionsHtml = `<span class="${colorClass} font-medium">[${paramName}${operatorSymbol}${condition.value}]</span> `;
  }
  // 普通事件：显示所有条件，用颜色区分是否满足
  else if (event.conditions && Object.keys(event.conditions).length > 0) {
    const conditionTags = [];
    
    for (const [key, value] of Object.entries(event.conditions)) {
      // 解析条件键（如 earth_gte, water_lte 等）
      const match = key.match(/^(.+)_(gte|lte|gt|lt|eq)$/);
      if (match) {
        const param = match[1];
        const operator = match[2];
        const paramName = getParamDisplayName(param);
        
        // 获取操作符符号
        const operatorSymbol = {
          'gte': '≥',
          'lte': '≤',
          'gt': '>',
          'lt': '<',
          'eq': '='
        }[operator] || '?';
        
        // 检查条件是否满足（从event.conditionResults中获取）
        const isSatisfied = event.conditionResults && event.conditionResults[key];
        
        // 统一显示所有条件：满足为绿色，不满足为灰色
        const colorClass = isSatisfied ? 'text-green-600' : 'text-gray-400';
        conditionTags.push(`<span class="${colorClass} font-medium">[${paramName}${operatorSymbol}${value}]</span>`);
      }
    }
    
    if (conditionTags.length > 0) {
      conditionsHtml = conditionTags.join(' ') + ' ';
    }
  }
  
  return `
    <div class="bg-white rounded-lg shadow-md p-3 hover:shadow-lg transition-shadow duration-200 animate-fadeIn">
      <p class="text-sm text-gray-700 leading-relaxed">
        <span class="font-bold text-blue-700">第${event.turn}回合：</span>${readParamsHtml}${conditionsHtml}${event.description || '发生了一些事情...'}${effectsHtml}
      </p>
    </div>
  `;
}

/**
 * 获取参数显示名称
 * @param {string} param - 参数键
 * @returns {string} 显示名称
 */
function getParamDisplayName(param) {
  const names = {
    // 能力属性
    foundation: '基础',
    thinking: '思维',
    plasticity: '可塑性',
    performance: '性能',
    principle: '原理',
    // 调节参数
    money: '钱',
    users: '用户',
    data: '数据',
    // 放大参数
    coding: '编程',
    text: '文本',
    voice: '语音',
    image: '图像',
    video: '视频',
    robot: '机器人',
    research: '科研',
    // 客观参数
    market: '市场',
    regulation: '监管',
    reputation: '风评',
    anxiety: '焦虑',
    // 决策参数
    earth: '地',
    water: '水',
    wind: '风',
    fire: '火',
    ether: '以太'
  };
  return names[param] || param;
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
          ${state.selectedTraits.map(trait => createTraitCard(trait, { cardClass: 'reserve-trait-card' })).join('')}
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
      
      // 使用正确的类名判断选中状态
      const isCurrentlySelected = card.classList.contains('bg-blue-100');
      
      // 取消所有选中状态
      traitCards.forEach(c => {
        updateTraitCardSelection(c, false);
      });
      
      if (isCurrentlySelected) {
        // 取消选中
        reservedTrait = null;
      } else {
        // 选中当前卡片，使用与词条选择界面完全一致的样式
        updateTraitCardSelection(card, true);
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
