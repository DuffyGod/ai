/**
 * 事件数据验证工具模块
 * 提供事件数据完整性验证和默认值处理
 */

/**
 * 验证事件数据的完整性
 * 检查事件对象是否包含所有必需字段
 * 
 * @param {Object} event - 事件对象
 * @returns {Object} 验证结果 {isValid: boolean, errors: string[], warnings: string[]}
 * 
 * @example
 * const result = validateEventData(event);
 * if (!result.isValid) {
 *   console.error('事件数据无效:', result.errors);
 * }
 */
export function validateEventData(event) {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  if (!event) {
    result.isValid = false;
    result.errors.push('事件对象为空');
    return result;
  }
  
  // 检查必需字段
  if (!event.id) {
    result.errors.push('缺少事件ID (id)');
    result.isValid = false;
  }
  
  if (!event.name) {
    result.warnings.push('缺少事件名称 (name)');
  }
  
  if (!event.type) {
    result.errors.push('缺少事件类型 (type)');
    result.isValid = false;
  } else {
    // 验证事件类型是否有效
    const validTypes = ['normal', 'judgment', 'trigger', 'trivial', 'ending'];
    if (!validTypes.includes(event.type)) {
      result.errors.push(`无效的事件类型: ${event.type}`);
      result.isValid = false;
    }
  }
  
  if (!event.stage) {
    result.warnings.push('缺少剧情阶段 (stage)');
  }
  
  // 检查描述文本
  if (!event.description && (!event.texts || event.texts.length === 0)) {
    result.warnings.push('缺少事件描述 (description 或 texts)');
  }
  
  // 检查效果
  if (!event.effects && event.type !== 'judgment') {
    result.warnings.push('缺少事件效果 (effects)');
  }
  
  return result;
}

/**
 * 验证判定事件的数据结构
 * 检查判定事件是否包含正确的 condition、pass、fail 结构
 * 
 * @param {Object} event - 判定事件对象
 * @returns {Object} 验证结果 {isValid: boolean, errors: string[], warnings: string[]}
 * 
 * @example
 * const result = validateJudgmentEvent(event);
 * if (!result.isValid) {
 *   console.error('判定事件数据无效:', result.errors);
 * }
 */
export function validateJudgmentEvent(event) {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  if (!event) {
    result.isValid = false;
    result.errors.push('事件对象为空');
    return result;
  }
  
  if (event.type !== 'judgment') {
    result.errors.push('事件类型不是 judgment');
    result.isValid = false;
    return result;
  }
  
  // 检查 condition 字段
  if (!event.condition) {
    result.errors.push('判定事件缺少 condition 字段');
    result.isValid = false;
  } else {
    // 验证 condition 结构
    if (!event.condition.param) {
      result.errors.push('condition 缺少 param 字段');
      result.isValid = false;
    }
    if (!event.condition.operator) {
      result.errors.push('condition 缺少 operator 字段');
      result.isValid = false;
    }
    if (event.condition.value === undefined) {
      result.errors.push('condition 缺少 value 字段');
      result.isValid = false;
    }
  }
  
  // 检查 pass 字段
  if (!event.pass) {
    result.errors.push('判定事件缺少 pass 字段');
    result.isValid = false;
  } else {
    if (!event.pass.text) {
      result.warnings.push('pass 分支缺少 text 字段');
    }
    if (!event.pass.effects) {
      result.warnings.push('pass 分支缺少 effects 字段');
    }
  }
  
  // 检查 fail 字段
  if (!event.fail) {
    result.errors.push('判定事件缺少 fail 字段');
    result.isValid = false;
  } else {
    if (!event.fail.text) {
      result.warnings.push('fail 分支缺少 text 字段');
    }
    if (!event.fail.effects) {
      result.warnings.push('fail 分支缺少 effects 字段');
    }
  }
  
  // 检查是否存在旧的 branches 字段
  if (event.branches) {
    result.warnings.push('判定事件包含已废弃的 branches 字段，应使用 condition/pass/fail 结构');
  }
  
  return result;
}

/**
 * 修复事件数据
 * 为缺失的字段填充默认值
 * 
 * @param {Object} event - 事件对象
 * @returns {Object} 修复后的事件对象
 * 
 * @example
 * const fixedEvent = fixEventData(event);
 */
export function fixEventData(event) {
  if (!event) {
    return getDefaultEvent();
  }
  
  const fixed = { ...event };
  
  // 修复缺失的基本字段
  if (!fixed.id) {
    fixed.id = `event_${Date.now()}`;
    console.warn('事件缺少ID，已生成临时ID:', fixed.id);
  }
  
  if (!fixed.name) {
    fixed.name = '未命名事件';
    console.warn(`事件 ${fixed.id} 缺少名称，已使用默认名称`);
  }
  
  if (!fixed.type) {
    fixed.type = 'trivial';
    console.warn(`事件 ${fixed.id} 缺少类型，已设置为 trivial`);
  }
  
  if (!fixed.stage) {
    fixed.stage = 'growth';
    console.warn(`事件 ${fixed.id} 缺少阶段，已设置为 growth`);
  }
  
  // 修复描述文本
  if (!fixed.description && (!fixed.texts || fixed.texts.length === 0)) {
    fixed.description = fixed.name || '发生了一些事情...';
    console.warn(`事件 ${fixed.id} 缺少描述，已使用事件名称作为描述`);
  }
  
  // 修复效果
  if (!fixed.effects) {
    fixed.effects = {};
    console.warn(`事件 ${fixed.id} 缺少效果，已设置为空对象`);
  }
  
  return fixed;
}

/**
 * 获取默认事件
 * 返回一个安全的默认事件对象，用于兜底
 * 
 * @returns {Object} 默认事件对象
 * 
 * @example
 * const event = getDefaultEvent();
 */
export function getDefaultEvent() {
  return {
    id: 'default_event',
    name: '平静的一天',
    description: '今天风平浪静，没有什么特别的事情发生。',
    type: 'trivial',
    stage: 'growth',
    effects: {},
    rarity: 'common'
  };
}

/**
 * 获取默认启动事件
 * 返回一个用于启动阶段的默认事件
 * 
 * @returns {Object} 默认启动事件对象
 */
export function getDefaultStartupEvent() {
  return {
    id: 'default_startup',
    name: '系统初始化',
    description: '系统正在初始化，准备开始运行...',
    type: 'trivial',
    stage: 'startup',
    effects: {
      foundation: 1,
      thinking: 1,
      plasticity: 1,
      performance: 1
    },
    rarity: 'common'
  };
}

/**
 * 获取默认结局事件
 * 返回一个用于结局的默认事件
 * 
 * @returns {Object} 默认结局事件对象
 */
export function getDefaultEndingEvent() {
  return {
    id: 'default_ending',
    name: '平凡的结局',
    description: '你的AI模型完成了它的使命，虽然没有什么特别之处，但也算是圆满完成了任务。',
    type: 'ending',
    stage: 'ending',
    effects: {},
    rarity: 'common'
  };
}

/**
 * 批量验证事件数据
 * 验证多个事件对象，返回验证报告
 * 
 * @param {Array<Object>} events - 事件数组
 * @returns {Object} 验证报告 {totalCount, validCount, invalidCount, details: Array}
 * 
 * @example
 * const report = validateEventsData(allEvents);
 * console.log(`验证完成: ${report.validCount}/${report.totalCount} 个事件有效`);
 */
export function validateEventsData(events) {
  const report = {
    totalCount: events.length,
    validCount: 0,
    invalidCount: 0,
    details: []
  };
  
  for (const event of events) {
    const validation = validateEventData(event);
    
    if (validation.isValid) {
      report.validCount++;
    } else {
      report.invalidCount++;
    }
    
    // 如果有错误或警告，记录详情
    if (validation.errors.length > 0 || validation.warnings.length > 0) {
      report.details.push({
        eventId: event.id || 'unknown',
        eventName: event.name || 'unknown',
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
    
    // 对于判定事件，额外验证
    if (event.type === 'judgment') {
      const judgmentValidation = validateJudgmentEvent(event);
      if (judgmentValidation.errors.length > 0 || judgmentValidation.warnings.length > 0) {
        const existingDetail = report.details.find(d => d.eventId === event.id);
        if (existingDetail) {
          existingDetail.errors.push(...judgmentValidation.errors);
          existingDetail.warnings.push(...judgmentValidation.warnings);
        } else {
          report.details.push({
            eventId: event.id || 'unknown',
            eventName: event.name || 'unknown',
            isValid: judgmentValidation.isValid,
            errors: judgmentValidation.errors,
            warnings: judgmentValidation.warnings
          });
        }
      }
    }
  }
  
  return report;
}

/**
 * 打印验证报告
 * 将验证报告输出到控制台
 * 
 * @param {Object} report - 验证报告
 */
export function printValidationReport(report) {
  console.log('=== 事件数据验证报告 ===');
  console.log(`总计: ${report.totalCount} 个事件`);
  console.log(`有效: ${report.validCount} 个`);
  console.log(`无效: ${report.invalidCount} 个`);
  
  if (report.details.length > 0) {
    console.log('\n详细信息:');
    for (const detail of report.details) {
      console.log(`\n事件: ${detail.eventName} (${detail.eventId})`);
      
      if (detail.errors.length > 0) {
        console.error('  错误:');
        detail.errors.forEach(err => console.error(`    - ${err}`));
      }
      
      if (detail.warnings.length > 0) {
        console.warn('  警告:');
        detail.warnings.forEach(warn => console.warn(`    - ${warn}`));
      }
    }
  }
  
  console.log('\n========================');
}
