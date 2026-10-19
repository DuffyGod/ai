# 固定视口与卡牌界面设计记录

调研与迭代日期：2026-10-19。目标是让核心游玩、准备、结局和辅助信息都在当前浏览器视口内完成。资料来自下列官方文档和公开源码；这是文献与实现调研，还不是玩家可用性研究。

## 查阅资料与采用的方法

| 资料 | 实际观察 | 本项目采用方式 |
| --- | --- | --- |
| [Godot：Multiple resolutions](https://github.com/godotengine/godot-docs/blob/master/tutorials/rendering/multiple_resolutions.rst) | 分别讨论桌面、横屏、竖屏；基准分辨率不等于每台设备的实际尺寸；要求兼顾宽高比与文字可读性。 | 同时按宽度和高度调整布局。桌面限制最大面板尺寸，手机使用动态视口；横屏重新排列，文字不随整张画面等比缩小。 |
| [Godot：Size and anchors](https://github.com/godotengine/godot-docs/blob/master/tutorials/ui/size_and_anchors.rst) | 控件的位置应相对父区域的边缘或中心定义，而不是假定固定设备坐标。 | 资源固定在上缘，行动与辅助入口固定在下缘；事件卡占用中间剩余空间。 |
| [Godot：Using Containers](https://github.com/godotengine/godot-docs/blob/master/tutorials/ui/gui_containers.rst) | 容器管理子控件的位置与可用空间；横向、纵向、网格、标签容器分别适用不同组织方式。 | 使用 CSS Grid/Flex 表达同样的空间约束；词条发牌、选项、手记用分页切换，不靠增加文档高度容纳内容。 |
| [人生重开模拟器公开源码：Play.tsx](https://github.com/VickScarlet/lifeRestart/blob/f04888e202e5dfca0df48c51b8a099dc03cf08b4/apps/web/src/containers/Play.tsx) | 当前公开版本分离属性区、日志区和控制区；支持下一步与自动推进。日志本身仍使用滚动容器。 | 借鉴状态、反馈、操作的分离以及推进节奏；本项目按本次要求改用记录分页。自动推进留待玩法实验，不在 UI 更新中加入。 |
| [人生重开模拟器：event.ts](https://github.com/VickScarlet/lifeRestart/blob/f04888e202e5dfca0df48c51b8a099dc03cf08b4/packages/core/src/event.ts)、[game.ts](https://github.com/VickScarlet/lifeRestart/blob/f04888e202e5dfca0df48c51b8a099dc03cf08b4/packages/core/src/game.ts) | 事件先按条件筛选；结算效果后可继续触发条件分支。界面之外存在独立的状态推进规则。 | 后续谜题优先组织为条件、证据和后续分支；继续保留纯规则引擎，避免让“读过某张 UI 卡片”偷偷成为触发条件。 |
| [inkle：Writing with ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md) 的 Conditional Choices、Conditional Text、Global Variables、Gathers | 文本与选项可以读取共享故事状态；分支可以汇合，先前决定的后果仍通过变量保留。 | 不增加永久分叉的页面，用条件文本表达世界变化。将关键选择、资源状态和日常回响分开组织，避免结局之前的反馈消失。 |
| [WCAG 2.2：Target Size (Minimum)](https://github.com/w3c/wcag/blob/main/understanding/22/target-size-minimum.html)、[Contrast (Minimum)](https://github.com/w3c/wcag/blob/main/understanding/20/contrast-minimum.html) | 最小目标尺寸以 24×24 CSS 像素为基准并有例外；普通文字最低对比度为 4.5:1。 | 开局主按钮保留 44 像素高度，以 24 像素作为最小控件参考，测量词条、效果和主按钮对比；勾选与边线共同表达选中状态。该测量不等同于整站 WCAG 合规认证。 |

Godot 文档提供的是布局与适配方法，并不要求本项目换用 Godot。当前静态 HTML/CSS/JS 足以实现这些约束，继续兼容 GitHub Pages。上述资料也没有规定本项目必须采用卡牌；卡牌是为匹配用户要求与离散事件结构作出的设计选择。

## 当前采用的方法

上一版的大立牌与逐张分页已被本轮替换。当前版本以横条列举为基础，保留三种视觉和布局候选：晨雾的双列比较、墨蓝的单列清单与组合详情、暮纸的横向档案。手机使用共同的紧凑双列，十个出生词条同屏。

- 固定游戏视口，主要操作保持在下方；准备页对大屏高度设上限，避免把横条拉成长卡片。
- 勾选表示构筑选择；鼠标悬停、键盘聚焦或触控选择更新完整说明。查看状态与选中状态分开。
- 事件选项直接列出；未满足的选项可以打开条件说明，操作不会推进游戏。
- 正文完整显示。结局优先使用阅读区域，横屏重新组织文本和重开操作。
- 手记以标题索引定位，未知信息保持留白；历史先定位周期，再选择记录。
- 在共同交互基础上保留三种配色与阅读布局，使用实际游戏截图对比，而不是只做几张无功能效果图。

完整过程见 [DESIGN_ITERATIONS.md](DESIGN_ITERATIONS.md)。`design/iterations/` 保存每轮测量、时间与核心 UI 源码 SHA-256 摘要；此前页面的失败结果也保留。

## 自主评估的边界

本轮将玩家需求拆为新手理解、快速重开、手机操作、阅读探索、键盘操作、视觉层级六类任务。浏览器可测量内容数量、导航点击、溢出、字号和对比度，并执行选择、取消、回看和存档流程。审美偏好、注意分配与单手舒适度通过设计者启发式判断比较，没有把这些判断包装成真人反馈或统计显著的用户研究。

当前检查使用 Chromium 的 CSS 视口，不代表已经做过真机 Safari、系统大字体与所有缩放比例的验证。后续真实试玩可以继续修正三种候选的排序。
