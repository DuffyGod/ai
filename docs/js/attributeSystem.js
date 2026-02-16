/**
 * 属性系统模块
 * 负责属性的初始化、分配和管理
 */

// 属性名称映射
export const ATTRIBUTE_NAMES = {
  efficiency: '效率与规模',
  cognition: '认知能力',
  controllability: '可控度',
  adaptability: '适应能力',
  explainability: '可解释性'
};

// 属性描述
export const ATTRIBUTE_DESCRIPTIONS = {
  efficiency: '处理任务的速度和可扩展性',
  cognition: '理解和推理的能力',
  controllability: '遵守规则和安全约束的程度',
  adaptability: '适应新场景和任务的能力',
  explainability: '解释决策过程的透明度'
};

/**
 * 生成随机初始属性
 * @returns {Object} 属性对象
 */
export function generateRandomAttributes() {
  const attributes = {};
  
  for (const key of Object.keys(ATTRIBUTE_NAMES)) {
    // 生成40-60之间的随机值
    attributes[key] = Math.floor(Math.random() * 21) + 40;
  }
  
  return attributes;
}

/**
 * 验证决策点数分配是否有效
 * @param {Object} allocation - 点数分配对象
 * @param {number} totalPoints - 总点数
 * @returns {boolean} 是否有效
 */
export function validateAllocation(allocation, totalPoints = 10) {
  // 检查是否所有属性都有分配
  for (const key of Object.keys(ATTRIBUTE_NAMES)) {
    if (allocation[key] === undefined || allocation[key] < 0) {
      return false;
    }
  }
  
  // 检查总和是否等于总点数
  const sum = Object.values(allocation).reduce((a, b) => a + b, 0);
  return sum === totalPoints;
}

/**
 * 应用决策点数到属性（用于显示，实际影响在事件系统中体现）
 * @param {Object} baseAttributes - 基础属性
 * @param {Object} allocation - 决策点数分配
 * @returns {Object} 应用后的属性（仅用于显示）
 */
export function applyDecisionPoints(baseAttributes, allocation) {
  const result = { ...baseAttributes };
  
  for (const [key, points] of Object.entries(allocation)) {
    if (result.hasOwnProperty(key)) {
      result[key] += points;
      // 限制在0-100之间
      result[key] = Math.max(0, Math.min(100, result[key]));
    }
  }
  
  return result;
}

/**
 * 获取属性的颜色类（根据数值）
 * @param {number} value - 属性值
 * @returns {string} Tailwind CSS类名
 */
export function getAttributeColorClass(value) {
  if (value >= 70) {
    return 'bg-green-600';
  } else if (value >= 50) {
    return 'bg-blue-600';
  } else if (value >= 30) {
    return 'bg-amber-600';
  } else {
    return 'bg-red-600';
  }
}

/**
 * 获取属性的文本颜色类（根据数值）
 * @param {number} value - 属性值
 * @returns {string} Tailwind CSS类名
 */
export function getAttributeTextColorClass(value) {
  if (value >= 70) {
    return 'text-green-700';
  } else if (value >= 50) {
    return 'text-blue-700';
  } else if (value >= 30) {
    return 'text-amber-700';
  } else {
    return 'text-red-700';
  }
}

/**
 * 格式化属性显示
 * @param {string} key - 属性键
 * @param {number} value - 属性值
 * @returns {string} 格式化的HTML
 */
export function formatAttributeDisplay(key, value) {
  const name = ATTRIBUTE_NAMES[key] || key;
  const colorClass = getAttributeColorClass(value);
  
  return `
    <div class="mb-3">
      <div class="flex justify-between items-center mb-1">
        <span class="text-sm font-medium text-gray-700">${name}</span>
        <span class="text-sm font-bold ${getAttributeTextColorClass(value)}">${value}</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div class="${colorClass} h-2 rounded-full transition-all duration-300" style="width: ${value}%"></div>
      </div>
    </div>
  `;
}

/**
 * 计算属性总分
 * @param {Object} attributes - 属性对象
 * @returns {number} 总分
 */
export function calculateTotalScore(attributes) {
  return Object.values(attributes).reduce((sum, value) => sum + value, 0);
}

/**
 * 获取属性评级
 * @param {Object} attributes - 属性对象
 * @returns {string} 评级（S/A/B/C/D）
 */
export function getAttributeRating(attributes) {
  const total = calculateTotalScore(attributes);
  const average = total / Object.keys(attributes).length;
  
  if (average >= 80) return 'S';
  if (average >= 70) return 'A';
  if (average >= 60) return 'B';
  if (average >= 50) return 'C';
  return 'D';
}

/**
 * 创建属性分配控件HTML（完整版，显示基础值和最终值）
 * 注意：决策点数用于影响后续事件发展，不直接改变初始属性
 * @param {string} key - 属性键
 * @param {number} baseValue - 基础属性值（随机生成）
 * @param {number} allocatedPoints - 已分配的决策点数
 * @returns {string} HTML字符串
 */
export function createAllocationControl(key, baseValue, allocatedPoints) {
  const name = ATTRIBUTE_NAMES[key] || key;
  const description = ATTRIBUTE_DESCRIPTIONS[key] || '';
  const finalValue = baseValue + allocatedPoints;
  
  return `
    <div class="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-purple-300 transition-colors">
      <div class="flex justify-between items-start mb-2">
        <div>
          <h4 class="font-bold text-gray-800">${name}</h4>
          <p class="text-xs text-gray-500 mt-1">${description}</p>
        </div>
        <div class="text-right">
          <div class="text-sm text-gray-600">基础: ${baseValue}</div>
          <div class="text-lg font-bold text-purple-600">最终: ${finalValue}</div>
        </div>
      </div>
      <div class="flex items-center gap-2 mt-3">
        <button class="allocation-btn-minus w-8 h-8 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed" 
                data-attr="${key}" 
                ${allocatedPoints <= 0 ? 'disabled' : ''}>
          -
        </button>
        <div class="flex-1 text-center">
          <span class="text-2xl font-bold text-purple-600 allocation-value" data-attr="${key}">${allocatedPoints}</span>
          <span class="text-sm text-gray-500 ml-1">点</span>
        </div>
        <button class="allocation-btn-plus w-8 h-8 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed" 
                data-attr="${key}">
          +
        </button>
      </div>
    </div>
  `;
}