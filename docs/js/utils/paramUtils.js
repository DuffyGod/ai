/**
 * 参数和条件处理工具模块
 * 提供统一的参数获取和条件检查功能
 */

/**
 * 获取参数值
 * 从游戏状态中获取指定参数的值，支持所有参数类型
 * 
 * @param {string} paramName - 参数名称
 * @param {Object} state - 游戏状态对象
 * @param {Object} state.decisionParams - 决策参数
 * @param {Object} state.abilityParams - 能力属性
 * @param {Object} state.resourceParams - 调节参数
 * @param {Object} state.amplifyParams - 放大参数
 * @param {Object} state.objectiveParams - 客观参数
 * @returns {number} 参数值，如果参数不存在则返回0
 * 
 * @example
 * const earthValue = getParamValue('earth', state);
 * const foundationValue = getParamValue('foundation', state);
 */
export function getParamValue(paramName, state) {
  // 决策参数 (earth, water, wind, fire)
  if (state.decisionParams && state.decisionParams[paramName] !== undefined) {
    return state.decisionParams[paramName];
  }
  
  // 能力属性 (foundation, thinking, plasticity, performance, principle)
  if (state.abilityParams && state.abilityParams[paramName] !== undefined) {
    return state.abilityParams[paramName];
  }
  
  // 调节参数 (money, users, data)
  if (state.resourceParams && state.resourceParams[paramName] !== undefined) {
    return state.resourceParams[paramName];
  }
  
  // 放大参数 (coding, text, voice, image, video, robot, research)
  if (state.amplifyParams && state.amplifyParams[paramName] !== undefined) {
    return state.amplifyParams[paramName];
  }
  
  // 客观参数 (market, regulation, reputation, anxiety)
  if (state.objectiveParams && state.objectiveParams[paramName] !== undefined) {
    return state.objectiveParams[paramName];
  }
  
  // 参数不存在，返回默认值0
  return 0;
}

/**
 * 解析条件键
 * 将形如 "earth_gte" 的条件键解析为参数名和操作符
 * 
 * @param {string} conditionKey - 条件键，格式为 "参数名_操作符"
 * @returns {Object|null} 解析结果 {param: string, operator: string}，解析失败返回null
 * 
 * @example
 * parseConditionKey('earth_gte') // => {param: 'earth', operator: 'gte'}
 * parseConditionKey('foundation_lt') // => {param: 'foundation', operator: 'lt'}
 * parseConditionKey('invalid') // => null
 */
export function parseConditionKey(conditionKey) {
  // 支持的操作符：gte(>=), lte(<=), gt(>), lt(<), eq(==)
  const match = conditionKey.match(/^(.+)_(gte|lte|gt|lt|eq)$/);
  
  if (match) {
    return {
      param: match[1],
      operator: match[2]
    };
  }
  
  return null;
}

/**
 * 检查单个条件
 * 比较实际值与阈值，根据操作符判断是否满足条件
 * 
 * @param {number} actualValue - 实际值
 * @param {string} operator - 操作符 (gte/>=, lte/<=, gt/>, lt/<, eq/==)
 * @param {number} threshold - 阈值
 * @returns {boolean} 是否满足条件
 * 
 * @example
 * checkCondition(5, 'gte', 3) // => true
 * checkCondition(5, 'lt', 3) // => false
 * checkCondition(5, '>=', 5) // => true
 */
export function checkCondition(actualValue, operator, threshold) {
  switch (operator) {
    case 'gte':
    case '>=':
      return actualValue >= threshold;
    
    case 'lte':
    case '<=':
      return actualValue <= threshold;
    
    case 'gt':
    case '>':
      return actualValue > threshold;
    
    case 'lt':
    case '<':
      return actualValue < threshold;
    
    case 'eq':
    case '==':
    case '===':
      return actualValue === threshold;
    
    default:
      console.warn(`未知的操作符: ${operator}`);
      return false;
  }
}

/**
 * 检查条件对象
 * 评估一个条件对象（包含参数名、操作符和阈值）
 * 
 * @param {Object} conditionObj - 条件对象
 * @param {string} conditionObj.param - 参数名
 * @param {string} conditionObj.operator - 操作符
 * @param {number} conditionObj.value - 阈值
 * @param {Object} state - 游戏状态
 * @returns {boolean} 是否满足条件
 * 
 * @example
 * checkConditionObject({param: 'earth', operator: 'gte', value: 5}, state)
 */
export function checkConditionObject(conditionObj, state) {
  if (!conditionObj || !conditionObj.param || !conditionObj.operator) {
    console.warn('无效的条件对象:', conditionObj);
    return false;
  }
  
  const actualValue = getParamValue(conditionObj.param, state);
  return checkCondition(actualValue, conditionObj.operator, conditionObj.value);
}

/**
 * 批量检查条件
 * 检查一个条件字典，所有条件都必须满足才返回true
 * 
 * @param {Object} conditions - 条件字典，键为条件键（如"earth_gte"），值为阈值
 * @param {Object} state - 游戏状态
 * @returns {boolean} 是否所有条件都满足
 * 
 * @example
 * checkConditions({
 *   earth_gte: 5,
 *   water_lt: 3,
 *   foundation_gte: 10
 * }, state)
 */
export function checkConditions(conditions, state) {
  if (!conditions || typeof conditions !== 'object') {
    return true; // 没有条件，视为满足
  }
  
  for (const [key, threshold] of Object.entries(conditions)) {
    const parsed = parseConditionKey(key);
    
    if (!parsed) {
      console.warn(`无法解析条件键: ${key}`);
      continue;
    }
    
    const actualValue = getParamValue(parsed.param, state);
    
    if (!checkCondition(actualValue, parsed.operator, threshold)) {
      return false; // 有一个条件不满足，立即返回false
    }
  }
  
  return true; // 所有条件都满足
}

/**
 * 评估条件并返回详细结果
 * 检查所有条件并返回每个条件的评估结果
 * 
 * @param {Object} conditions - 条件字典
 * @param {Object} state - 游戏状态
 * @returns {Object} 评估结果，键为条件键，值为布尔值
 * 
 * @example
 * evaluateConditions({earth_gte: 5, water_lt: 3}, state)
 * // => {earth_gte: true, water_lt: false}
 */
export function evaluateConditions(conditions, state) {
  const results = {};
  
  if (!conditions || typeof conditions !== 'object') {
    return results;
  }
  
  for (const [key, threshold] of Object.entries(conditions)) {
    const parsed = parseConditionKey(key);
    
    if (!parsed) {
      console.warn(`无法解析条件键: ${key}`);
      results[key] = false;
      continue;
    }
    
    const actualValue = getParamValue(parsed.param, state);
    results[key] = checkCondition(actualValue, parsed.operator, threshold);
  }
  
  return results;
}

/**
 * 获取参数的中文名称
 * 
 * @param {string} paramName - 参数名称
 * @returns {string} 中文名称
 */
export function getParamDisplayName(paramName) {
  const nameMap = {
    // 决策参数
    earth: '可塑性',
    water: '推理',
    wind: '性能',
    fire: '基座',
    
    // 能力属性
    foundation: '基座',
    thinking: '推理',
    plasticity: '可塑性',
    performance: '性能',
    principle: '原则',
    
    // 调节参数
    money: '资金',
    users: '用户',
    data: '数据',
    
    // 放大参数
    coding: '编程',
    text: '文本',
    voice: '语音',
    image: '图像',
    video: '视频',
    robot: '机器人',
    research: '研究',
    
    // 客观参数
    market: '市场',
    regulation: '监管',
    reputation: '风评',
    anxiety: '焦虑'
  };
  
  return nameMap[paramName] || paramName;
}
