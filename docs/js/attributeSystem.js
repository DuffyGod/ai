/**
 * 属性系统模块（临时兼容层）
 * 提供与旧代码的兼容性，同时逐步迁移到新的参数系统
 */

// 属性名称映射
export const ATTRIBUTE_NAMES = {
  efficiency: '效率与规模',
  cognition: '认知能力',
  controllability: '可控度',
  adaptability: '适应能力',
  explainability: '可解释性'
};

/**
 * 生成随机基础属性
 * @returns {Object} 属性对象
 */
export function generateRandomAttributes() {
  return {
    efficiency: Math.floor(Math.random() * 30) + 20,
    cognition: Math.floor(Math.random() * 30) + 20,
    controllability: Math.floor(Math.random() * 30) + 20,
    adaptability: Math.floor(Math.random() * 30) + 20,
    explainability: Math.floor(Math.random() * 30) + 20
  };
}

/**
 * 应用决策点数到属性
 * @param {Object} baseAttributes - 基础属性
 * @param {Object} allocation - 点数分配
 * @returns {Object} 最终属性
 */
export function applyDecisionPoints(baseAttributes, allocation) {
  const result = { ...baseAttributes };
  
  for (const [attr, points] of Object.entries(allocation)) {
    if (result.hasOwnProperty(attr)) {
      result[attr] += points * 5; // 每点增加5
      result[attr] = Math.max(0, Math.min(100, result[attr]));
    }
  }
  
  return result;
}

/**
 * 获取属性评级
 * @param {number} value - 属性值
 * @returns {string} 评级（S/A/B/C/D）
 */
export function getAttributeGrade(value) {
  if (value >= 90) return 'S';
  if (value >= 75) return 'A';
  if (value >= 60) return 'B';
  if (value >= 40) return 'C';
  return 'D';
}

/**
 * 获取属性颜色类
 * @param {number} value - 属性值
 * @returns {string} Tailwind CSS类名
 */
export function getAttributeColorClass(value) {
  if (value >= 90) return 'bg-purple-600';
  if (value >= 75) return 'bg-blue-600';
  if (value >= 60) return 'bg-green-600';
  if (value >= 40) return 'bg-yellow-600';
  return 'bg-gray-600';
}

/**
 * 获取属性文本颜色类
 * @param {number} value - 属性值
 * @returns {string} Tailwind CSS类名
 */
export function getAttributeTextColorClass(value) {
  if (value >= 90) return 'text-purple-700';
  if (value >= 75) return 'text-blue-700';
  if (value >= 60) return 'text-green-700';
  if (value >= 40) return 'text-yellow-700';
  return 'text-gray-700';
}

/**
 * 创建属性分配控件
 * @param {string} attrKey - 属性键
 * @param {number} allocatedPoints - 已分配点数
 * @returns {string} HTML字符串
 */
export function createAllocationControl(attrKey, allocatedPoints) {
  const name = ATTRIBUTE_NAMES[attrKey] || attrKey;
  
  return `
    <div class="bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-blue-300 transition-colors">
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-bold text-gray-800">${name}</h4>
        <div class="text-2xl font-bold text-blue-600">${allocatedPoints}</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="allocation-btn-minus w-10 h-10 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg" 
                data-attr="${attrKey}" 
                ${allocatedPoints <= 0 ? 'disabled' : ''}>
          -
        </button>
        <div class="flex-1 text-center">
          <div class="text-3xl font-bold text-blue-600 allocation-value" data-attr="${attrKey}">${allocatedPoints}</div>
        </div>
        <button class="allocation-btn-plus w-10 h-10 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-lg" 
                data-attr="${attrKey}">
          +
        </button>
      </div>
    </div>
  `;
}
