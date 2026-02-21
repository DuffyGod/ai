/**
 * 参数系统模块
 * 负责参数的管理、验证和显示
 */

import { isEtherActivated } from './gameState.js';

// 决策参数名称映射
export const DECISION_PARAMS = {
  earth: '地',
  water: '水',
  wind: '风',
  fire: '火',
  ether: '以太'
};

// 决策参数描述
export const DECISION_PARAM_DESCRIPTIONS = {
  earth: '参数量·预训练·对齐·安全',
  water: '分析·深度思考·Agent',
  wind: '记忆·上下文·规则遵循',
  fire: '算力·优化·推理效率',
  ether: '可解释性·理论研究'
};

// 能力属性名称映射
export const ABILITY_PARAMS = {
  foundation: '基础',
  thinking: '思维',
  plasticity: '可塑性',
  performance: '性能',
  principle: '原理'
};

// 调节参数名称映射
export const RESOURCE_PARAMS = {
  money: '钱',
  users: '用户',
  data: '数据'
};

// 放大参数名称映射
export const AMPLIFY_PARAMS = {
  coding: '编程',
  text: '文本',
  voice: '语音',
  image: '图像',
  video: '视频',
  robot: '机器人',
  research: '科研'
};

// 客观参数名称映射
export const OBJECTIVE_PARAMS = {
  market: '市场',
  regulation: '监管',
  reputation: '风评',
  anxiety: '焦虑'
};

// 参数范围配置
export const PARAM_RANGES = {
  decisionParams: { min: 0, max: 10 },
  abilityParams: { min: 0, max: null },  // 无上限
  resourceParams: { min: 0, max: 100 },
  amplifyParams: { min: 0, max: 10 },
  objectiveParams: { min: -5, max: 5 }
};

/**
 * 获取可用的决策参数列表（根据以太激活状态）
 * @returns {Array} 参数键数组
 */
export function getAvailableDecisionParams() {
  const params = ['earth', 'water', 'wind', 'fire'];
  if (isEtherActivated()) {
    params.push('ether');
  }
  return params;
}

/**
 * 验证决策点数分配是否有效
 * @param {Object} allocation - 点数分配对象
 * @param {number} totalPoints - 总点数（默认10）
 * @returns {boolean} 是否有效
 */
export function validateDecisionAllocation(allocation, totalPoints = 10) {
  const availableParams = getAvailableDecisionParams();
  
  // 检查是否所有参数都有分配
  for (const key of availableParams) {
    if (allocation[key] === undefined || allocation[key] < 0) {
      return false;
    }
  }
  
  // 检查总和是否等于总点数
  const sum = availableParams.reduce((total, key) => total + (allocation[key] || 0), 0);
  return sum === totalPoints;
}

/**
 * 限制参数值在指定范围内
 * @param {number} value - 参数值
 * @param {string} paramType - 参数类型
 * @returns {number} 限制后的值
 */
export function clampParamValue(value, paramType) {
  const range = PARAM_RANGES[paramType];
  if (!range) return value;
  
  let result = value;
  if (range.min !== null) {
    result = Math.max(range.min, result);
  }
  if (range.max !== null) {
    result = Math.min(range.max, result);
  }
  return result;
}

/**
 * 获取参数的颜色类（根据数值）
 * @param {number} value - 参数值
 * @param {string} paramType - 参数类型
 * @returns {string} Tailwind CSS类名
 */
export function getParamColorClass(value, paramType) {
  if (paramType === 'objectiveParams') {
    // 客观参数：负数红色，正数绿色
    if (value > 2) return 'bg-green-600';
    if (value > 0) return 'bg-green-500';
    if (value === 0) return 'bg-gray-500';
    if (value > -3) return 'bg-orange-500';
    return 'bg-red-600';
  }
  
  // 其他参数：根据数值大小
  if (value >= 8) return 'bg-green-600';
  if (value >= 5) return 'bg-blue-600';
  if (value >= 3) return 'bg-amber-600';
  if (value > 0) return 'bg-orange-500';
  return 'bg-gray-500';
}

/**
 * 获取参数的文本颜色类（根据数值）
 * @param {number} value - 参数值
 * @param {string} paramType - 参数类型
 * @returns {string} Tailwind CSS类名
 */
export function getParamTextColorClass(value, paramType) {
  if (paramType === 'objectiveParams') {
    if (value > 2) return 'text-green-700';
    if (value > 0) return 'text-green-600';
    if (value === 0) return 'text-gray-700';
    if (value > -3) return 'text-orange-600';
    return 'text-red-700';
  }
  
  if (value >= 8) return 'text-green-700';
  if (value >= 5) return 'text-blue-700';
  if (value >= 3) return 'text-amber-700';
  if (value > 0) return 'text-orange-600';
  return 'text-gray-700';
}

/**
 * 格式化参数显示（进度条样式）
 * @param {string} key - 参数键
 * @param {number} value - 参数值
 * @param {string} paramType - 参数类型
 * @returns {string} 格式化的HTML
 */
export function formatParamDisplay(key, value, paramType) {
  const nameMap = {
    decisionParams: DECISION_PARAMS,
    abilityParams: ABILITY_PARAMS,
    resourceParams: RESOURCE_PARAMS,
    amplifyParams: AMPLIFY_PARAMS,
    objectiveParams: OBJECTIVE_PARAMS
  }[paramType];
  
  const name = nameMap[key] || key;
  const colorClass = getParamColorClass(value, paramType);
  const textColorClass = getParamTextColorClass(value, paramType);
  
  // 计算进度条宽度百分比
  let percentage = 0;
  if (paramType === 'objectiveParams') {
    // 客观参数：-5到5映射到0-100%
    percentage = ((value + 5) / 10) * 100;
  } else {
    const range = PARAM_RANGES[paramType];
    const max = range.max || 10;
    percentage = (value / max) * 100;
  }
  
  return `
    <div class="mb-2">
      <div class="flex justify-between items-center mb-1">
        <span class="text-sm font-medium text-gray-700">${name}</span>
        <span class="text-sm font-bold ${textColorClass}">${value}</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div class="${colorClass} h-2 rounded-full transition-all duration-300" style="width: ${Math.max(0, Math.min(100, percentage))}%"></div>
      </div>
    </div>
  `;
}

/**
 * 创建决策参数分配控件HTML
 * @param {string} key - 参数键
 * @param {number} allocatedPoints - 已分配的点数
 * @returns {string} HTML字符串
 */
export function createDecisionAllocationControl(key, allocatedPoints) {
  const name = DECISION_PARAMS[key] || key;
  const description = DECISION_PARAM_DESCRIPTIONS[key] || '';
  
  return `
    <div class="bg-white p-2 rounded-md border border-gray-300 hover:border-blue-400 transition-colors">
      <div class="flex items-center justify-between gap-2">
        <div class="flex-1 min-w-0">
          <h4 class="font-bold text-gray-800 text-sm">${name}</h4>
          <p class="text-xs text-gray-500 truncate">${description}</p>
        </div>
        <div class="flex items-center gap-1.5">
          <button class="allocation-btn-minus w-7 h-7 rounded bg-red-500 text-white hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-sm flex items-center justify-center" 
                  data-param="${key}" 
                  ${allocatedPoints <= 0 ? 'disabled' : ''}>
            -
          </button>
          <div class="w-8 text-center">
            <div class="text-lg font-bold text-blue-600 allocation-value" data-param="${key}">${allocatedPoints}</div>
          </div>
          <button class="allocation-btn-plus w-7 h-7 rounded bg-green-500 text-white hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-sm flex items-center justify-center" 
                  data-param="${key}">
            +
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 获取参数的图标（用于UI展示）
 * @param {string} key - 参数键
 * @param {string} paramType - 参数类型
 * @returns {string} 图标emoji或HTML
 */
export function getParamIcon(key, paramType) {
  const icons = {
    decisionParams: {
      earth: '🌍',
      water: '💧',
      wind: '🌪️',
      fire: '🔥',
      ether: '✨'
    },
    abilityParams: {
      foundation: '🏗️',
      thinking: '🧠',
      plasticity: '🔄',
      performance: '⚡',
      principle: '📐'
    },
    resourceParams: {
      money: '💰',
      users: '👥',
      data: '📊'
    },
    amplifyParams: {
      coding: '💻',
      text: '📝',
      voice: '🎤',
      image: '🖼️',
      video: '🎬',
      robot: '🤖',
      research: '🔬'
    },
    objectiveParams: {
      market: '📈',
      regulation: '⚖️',
      reputation: '⭐',
      anxiety: '😰'
    }
  };
  
  return icons[paramType]?.[key] || '•';
}

/**
 * 格式化参数变化文本
 * @param {Object} changes - 参数变化对象 {paramKey: changeValue}
 * @param {string} paramType - 参数类型
 * @returns {string} 格式化的HTML
 */
export function formatParamChanges(changes, paramType) {
  const nameMap = {
    decisionParams: DECISION_PARAMS,
    abilityParams: ABILITY_PARAMS,
    resourceParams: RESOURCE_PARAMS,
    amplifyParams: AMPLIFY_PARAMS,
    objectiveParams: OBJECTIVE_PARAMS
  }[paramType];
  
  const parts = [];
  for (const [key, change] of Object.entries(changes)) {
    if (change !== 0) {
      const name = nameMap[key] || key;
      const icon = getParamIcon(key, paramType);
      const color = change > 0 ? 'text-green-600' : 'text-red-600';
      const sign = change > 0 ? '+' : '';
      parts.push(`<span class="${color}">${icon}${name}${sign}${change}</span>`);
    }
  }
  
  return parts.length > 0 ? parts.join(', ') : '<span class="text-gray-600">无变化</span>';
}

/**
 * 获取所有参数的摘要信息
 * @param {Object} state - 游戏状态
 * @returns {Object} 参数摘要
 */
export function getParamsSummary(state) {
  return {
    decision: state.decisionParams,
    ability: state.abilityParams,
    resource: state.resourceParams,
    amplify: state.amplifyParams,
    objective: state.objectiveParams
  };
}
