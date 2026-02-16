# AI发展模拟器 - 视觉风格重构实施计划

## 任务清单

### 第一阶段：全局样式和CSS变量定义（高优先级）

- [ ] 1. 更新index.html全局样式
  - 在`<style>`标签中定义CSS变量（主色、背景色、文字颜色、圆角等）
  - 更新自定义滚动条样式为深色系
  - 移除或更新过度圆润的动画效果
  - 添加统一的组件样式类（.btn-primary、.btn-secondary、.card-standard等）
  - _需求：1, 2, 5_

### 第二阶段：落地页视觉重构（高优先级）

- [ ] 2. 重构landingPage.js的视觉风格
  - 将背景渐变从`from-purple-500 via-pink-500 to-red-500`改为`from-slate-900 via-slate-800 to-slate-900`
  - 移除所有emoji表情符号（🤖、✨、🚀、🎮）
  - 将主卡片圆角从`rounded-3xl`改为`rounded-lg`
  - 移除装饰性图标容器（三个圆形图标）
  - 更新标题渐变色为深蓝色系`from-blue-800 to-blue-600`
  - 将按钮从`rounded-xl`改为`rounded-md`，颜色改为深蓝色系
  - 更新按钮文字，移除emoji
  - 调整字体大小，标题从`text-5xl md:text-6xl`改为`text-3xl md:text-4xl`
  - 更新悬停效果，移除`hover:scale-105`，改为轻微的阴影变化
  - _需求：1, 2, 3, 4, 6_

### 第三阶段：准备阶段页面重构（高优先级）

- [ ] 3. 重构preparationPage.js - 词条抽取页面
  - 更新背景渐变为深色系
  - 移除emoji表情符号
  - 将卡片圆角从`rounded-3xl`改为`rounded-lg`
  - 更新按钮样式为深蓝色系，圆角改为`rounded-md`
  - 调整字体大小和字重
  - _需求：1, 2, 3, 4_

- [ ] 4. 重构preparationPage.js - 词条选择页面
  - 更新词条卡片的稀有度颜色为深色系：
    - common: `border-gray-400 bg-gray-100 text-gray-700`
    - rare: `border-blue-600 bg-blue-50 text-blue-800`
    - epic: `border-indigo-600 bg-indigo-50 text-indigo-800`
    - legendary: `border-amber-600 bg-amber-50 text-amber-800`
  - 将卡片圆角统一为`rounded-lg`
  - 移除过度的缩放效果，改为边框高亮
  - 更新选中状态的视觉反馈
  - 调整卡片内边距和间距
  - _需求：1, 2, 5, 6_

- [ ] 5. 重构preparationPage.js - 属性分配页面
  - 更新属性面板的颜色为深色系
  - 将控件圆角从`rounded-full`改为`rounded-md`
  - 更新按钮颜色（+按钮改为深绿色，-按钮改为深红色）
  - 调整进度条颜色为深色系
  - 移除emoji和装饰性元素
  - 统一字体大小和字重
  - _需求：1, 2, 3, 4, 5_

### 第四阶段：体验阶段页面重构（高优先级）

- [ ] 6. 重构experiencePage.js - 顶部信息栏
  - 更新背景色为深色系渐变
  - 调整文字颜色为白色或浅色
  - 更新属性显示的颜色方案
  - 调整字体大小，从`text-xl`改为`text-lg`
  - 移除过度的阴影效果
  - _需求：1, 4, 5_

- [ ] 7. 重构experiencePage.js - 事件卡片
  - 将卡片圆角从`rounded-xl`改为`rounded-lg`
  - 更新卡片背景色和边框色
  - 调整卡片内边距
  - 移除emoji表情符号
  - 统一事件类型标识的颜色为深色系
  - 更新效果显示的颜色（正向用深绿色，负向用深红色）
  - _需求：1, 2, 3, 5_

- [ ] 8. 重构experiencePage.js - 结局事件卡片
  - 更新结局卡片的特殊样式为深色系
  - 调整边框颜色（使用深蓝色或深紫色）
  - 移除emoji和装饰性元素
  - 统一词条保留界面的样式
  - 更新返回按钮样式
  - _需求：1, 2, 3, 5_

### 第五阶段：traitSystem.js颜色函数更新（中优先级）

- [ ] 9. 更新traitSystem.js中的颜色函数
  - 修改`getRarityColorClass()`函数，返回新的深色系颜色类名
  - 修改`getRarityTextClass()`函数，返回新的深色系文本颜色
  - 确保所有稀有度颜色统一使用新配色方案
  - _需求：5_

### 第六阶段：attributeSystem.js颜色函数更新（中优先级）

- [ ] 10. 更新attributeSystem.js中的颜色函数
  - 修改`getAttributeColorClass()`函数，使用深色系颜色
  - 修改`getAttributeTextColorClass()`函数，使用深色系文本颜色
  - 更新进度条颜色方案
  - _需求：5_

### 第七阶段：交互反馈优化（低优先级）

- [ ] 11. 优化全局交互反馈效果
  - 在index.html中更新悬停效果CSS
  - 移除过度的缩放动画（`hover:scale-105`等）
  - 添加轻微的阴影变化效果
  - 优化按钮点击反馈
  - 确保所有交互效果克制而专业
  - _需求：6_

### 第八阶段：测试和验证（必需）

- [ ] 12. 全面测试和验证
  - 测试所有页面的视觉一致性
  - 验证色彩对比度是否符合WCAG标准
  - 测试响应式设计在不同屏幕尺寸下的表现
  - 检查是否有遗漏的emoji或装饰性元素
  - 验证所有交互反馈是否符合设计规范
  - 确保文字清晰可读
  - 生成预览链接供用户验证
  - _需求：1, 2, 3, 4, 5, 6_

## 技术实现要点

### 项目结构
```
/
├── index.html              # 全局样式和CSS变量
├── js/
│   ├── landingPage.js     # 落地页（需重构）
│   ├── preparationPage.js # 准备阶段（需重构）
│   ├── experiencePage.js  # 体验阶段（需重构）
│   ├── traitSystem.js     # 词条系统（需更新颜色函数）
│   └── attributeSystem.js # 属性系统（需更新颜色函数）
```

### 关键设计决策

#### 1. CSS变量定义
在index.html中定义全局CSS变量，便于统一管理和快速调整：
```css
:root {
  --color-primary: #1e40af;
  --color-primary-dark: #1e3a8a;
  --color-secondary: #374151;
  --color-success: #059669;
  --color-warning: #d97706;
  --color-error: #dc2626;
  --color-text-primary: #1f2937;
  --color-text-secondary: #6b7280;
  --color-bg-main: #0f172a;
  --color-bg-card: #ffffff;
  --border-radius-sm: 4px;
  --border-radius-md: 6px;
  --border-radius-lg: 8px;
}
```

#### 2. 颜色替换映射表

**背景渐变：**
- 原：`from-purple-500 via-pink-500 to-red-500`
- 新：`from-slate-900 via-slate-800 to-slate-900`

**按钮颜色：**
- 原：`from-purple-600 to-pink-600`
- 新：`from-blue-800 to-blue-700` 或 `bg-blue-800 hover:bg-blue-900`

**标题渐变：**
- 原：`from-purple-600 to-pink-600`
- 新：`from-blue-800 to-blue-600`

**圆角尺寸：**
- `rounded-3xl` → `rounded-lg`
- `rounded-xl` → `rounded-md`
- `rounded-full` → `rounded-md`（按钮）

**字体大小：**
- `text-5xl md:text-6xl` → `text-3xl md:text-4xl`
- `text-xl` → `text-lg`

#### 3. 稀有度颜色映射

| 稀有度 | 原配色 | 新配色（深色系） |
|--------|--------|------------------|
| common | `border-gray-300 bg-gray-50` | `border-gray-400 bg-gray-100 text-gray-700` |
| rare | `border-blue-400 bg-blue-50` | `border-blue-600 bg-blue-50 text-blue-800` |
| epic | `border-purple-400 bg-purple-50` | `border-indigo-600 bg-indigo-50 text-indigo-800` |
| legendary | `border-yellow-400 bg-yellow-50` | `border-amber-600 bg-amber-50 text-amber-800` |

#### 4. 需要移除的emoji清单
- 🤖（机器人）
- ✨（闪光）
- 🚀（火箭）
- 🎮（游戏手柄）
- 以及其他所有emoji表情符号

#### 5. 交互效果调整
- 移除：`hover:scale-105`、`transform hover:scale-105`
- 添加：`hover:shadow-lg`、轻微的颜色变化
- 保持：`transition-all duration-300`（平滑过渡）

## 实施顺序说明

任务按照优先级和依赖关系排序：

1. **第一阶段（任务1）**：先定义全局样式和CSS变量，为后续工作提供基础
2. **第二阶段（任务2）**：重构落地页，这是用户第一眼看到的页面
3. **第三阶段（任务3-5）**：重构准备阶段的三个子页面
4. **第四阶段（任务6-8）**：重构体验阶段页面
5. **第五、六阶段（任务9-10）**：更新颜色函数，确保系统级一致性
6. **第七阶段（任务11）**：优化交互反馈
7. **第八阶段（任务12）**：全面测试和验证

每个任务完成后需要确保：
- 代码符合新的设计规范
- 移除所有emoji和装饰性元素
- 颜色、圆角、字体等符合统一标准
- 交互效果克制而专业
- 在不同屏幕尺寸下表现良好

## 边界情况处理

1. **响应式设计**：确保深色系在移动端仍然清晰可读
2. **对比度检查**：使用工具验证文字与背景的对比度 ≥ 4.5:1
3. **渐进增强**：确保在不支持CSS变量的浏览器中有降级方案
4. **性能优化**：避免过度使用阴影和渐变影响性能
5. **可访问性**：确保颜色变化不影响色盲用户的使用

## 成功标准

1. ✅ 所有页面使用深色系主色调
2. ✅ 移除所有emoji表情符号
3. ✅ 圆角统一为小圆角（rounded-lg或rounded-md）
4. ✅ 字体大小适中，排版专业
5. ✅ 稀有度颜色统一使用深色系方案
6. ✅ 交互反馈克制而清晰
7. ✅ 所有页面视觉风格一致
8. ✅ 文字对比度符合WCAG标准
9. ✅ 响应式设计在各种设备上表现良好
10. ✅ 用户感受到界面更加专业、可信
