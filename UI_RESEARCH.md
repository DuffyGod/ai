# 界面与重开反馈：资料和取舍

记录日期：2026-10-19。以下区分可核查的源码、中文玩家反馈和本项目的设计判断。没有把个别帖子当成社区共识，也没有把自动检查当成真人可用性研究。

## 中文玩家反馈与公开实现

《人生重开模拟器》的原仓库 `VickScarlet/lifeRestart` 现重定向为 `VickScarlet/remake`。源码引用固定于 `f04888e202e5dfca0df48c51b8a099dc03cf08b4`，避免日后修改导致观察失真。

| 实读来源 | 可核查的观察 | 本项目的设计判断与本轮应用 |
| --- | --- | --- |
| [颜色定义](https://github.com/VickScarlet/remake/blob/f04888e202e5dfca0df48c51b8a099dc03cf08b4/apps/web/src/styles/colors.css)、[天赋横条样式](https://github.com/VickScarlet/remake/blob/f04888e202e5dfca0df48c51b8a099dc03cf08b4/apps/web/src/components/Talent.css) | 天赋等级以灰、蓝、紫、金表达，并参与文字、边框和选中底色。 | 稀有度颜色是信息，不应随简化一起删除。恢复四档颜色；侧边和名称表达稀有度，青绿填色与勾选表达当前选择。减少视觉手法的数量，保留信息职责。 |
| [天赋数据](https://github.com/VickScarlet/remake/blob/f04888e202e5dfca0df48c51b8a099dc03cf08b4/packages/data/src/talent.xlsx) | 天赋既有初始加点，也有明确年龄、属性条件；高等级还可能承诺另一段玩法。 | 稀有度带来价值预期。当前切片先校准四档总加点 1／2／3／4，去掉稀有与史诗完全同效的实例；后续更适合用特殊经历形成价值，不继续只加大点数。初始符号 3／5 的条件直接改变事件。 |
| [Issue #351：手动点太累了，自动玩](https://github.com/VickScarlet/remake/issues/351) | 一位玩家贴出包含抽天赋、选三项、随机加点、推进、结算与再次重开的自动脚本。 | 重开可能整段变成重复操作；只缩短某一个按钮流程还不够。本轮让手记承接下一局的可验证假设，恢复最近三个的直接替换。暂缓自动整局重开；连续推进如加入，必须在新线索、关键决定和供能危险前停下。 |
| [Issue #293：重开一百多次，没有一次转魂修的](https://github.com/VickScarlet/remake/issues/293) | 一位玩家报告大量重开仍没有进入期待阶段；帖子不足以判断概率、构筑或程序问题。 | 玩家需要区分“假设不成立”和“还没抽中”。本轮关键事件确定出现，统一门槛可重复验证，失败也能记下已遇到的条件；随机性用于起点组合和日常变化。 |
| [Issue #178：两个 BUG 和两个建议](https://github.com/VickScarlet/remake/issues/178) | 作者提出总结显示死因、未选继承天赋时提醒，并报告亮色模式属性不可见。 | 反馈应该解释实际原因。供能归零明确停机；选择后的文字说明使用了哪条属性或行动路径；结局显示已保留词条，并可回看独有的具名后果。稀有度也有文字说明，选中不会盖掉稀有度颜色。 |

这些反馈支持我们检查具体风险，不足以证明某一种 UI 必然最优。

## 布局与条件叙事的方法

| 实读资料 | 采用的方法 |
| --- | --- |
| [Godot：Multiple resolutions](https://github.com/godotengine/godot-docs/blob/master/tutorials/rendering/multiple_resolutions.rst)、[Size and anchors](https://github.com/godotengine/godot-docs/blob/master/tutorials/ui/size_and_anchors.rst)、[Using Containers](https://github.com/godotengine/godot-docs/blob/master/tutorials/ui/gui_containers.rst) | 按可用宽度和高度组织容器，不把整张界面等比缩小。桌面限制游戏面板，竖屏重排四格分配，低高度横屏重新分列。关键事件选项多时压成双列，为完整正文留空间。项目继续使用静态网页，无须换引擎。 |
| [inkle：Writing with ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md) 的 Conditional Choices、Conditional Text、Global Variables、Gathers | 用共享事实决定可选项与后续文字，分支汇合后仍保留实际承诺。删除开放、信任等累计分数，使用共享修改、否决权、独立副本等事实生成世界回响。 |
| [人生重开模拟器：event.ts](https://github.com/VickScarlet/remake/blob/f04888e202e5dfca0df48c51b8a099dc03cf08b4/packages/core/src/event.ts)、[game.ts](https://github.com/VickScarlet/remake/blob/f04888e202e5dfca0df48c51b8a099dc03cf08b4/packages/core/src/game.ts) | 规则与界面分开；事件先检查条件再结算。手记阅读本身不偷偷提供属性加成，固定种子可以做因果对照。 |
| [WCAG 2.2：Target Size](https://github.com/w3c/wcag/blob/main/understanding/22/target-size-minimum.html)、[Contrast](https://github.com/w3c/wcag/blob/main/understanding/20/contrast-minimum.html) | 主要按钮保留 44px 高度；紧凑加点控件仍有独立目标与间距。文字测量 4.5:1 对比，选中有勾选，稀有度有可读取名称。局部测量不等于整站合规认证。 |

## 当前设计的检验方法

1. **信息职责审查**：每种颜色、线条、数字都对应玩家当下的判断。稀有度与选中分别表达；去掉独立悬停强调、嵌套卡片、常驻世界计分。
2. **知识循环审查**：遇到事件 → 看见条件或触发结果 → 手记留下规律 → 下局改变初始值 → 验证选择差异。不是仅给每次行动增加更多正负号。
3. **同种子对照**：相同行动序列下比较四符号的 2／3、4／5，检查真实可选项和实际结果文字；另验证低风、低水可用两次相关行动走替代路径。
4. **固定视口检查**：320×568、390×664、1280×800、667×375，覆盖所有事件、结局和辅助目录；检查页面、文本容器和按钮边界，禁止用裁切掩盖溢出。
5. **完整循环检查**：真实点击短局和长局，验证最近三项队列、返回加点、实际值、刷新、继承和本局独有的结局后果。

前十轮方案的历史记录见 [DESIGN_ITERATIONS.md](DESIGN_ITERATIONS.md)。本轮使用独立的规则对照与浏览器检查，历史数据保持原样。

## 仍需要真实玩家回答

- 不读说明时，能否理解替换顺序和词条颜色？
- 一局后，能否提出“下次把某符号调到某值”的具体假设？
- 低稀有度的集中加点是否仍有用途，还是只会无脑选最高颜色？
- 长线的校验、旁听是否仍产生新信息，还是只剩补供能和等待事件？

浏览器自动化不能回答审美、注意分配与重开意愿。本轮只保证这些问题有明确的规则与可观察行为可供试玩检验。
