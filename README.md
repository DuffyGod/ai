# 余响协议 · AI 发展模拟器

一个以 AI 本身为玩家的静态网页游戏。以「人生重开模拟器」的短局重开为入口，以「密教模拟器」式的规律发现连接长线探索，最终抵达不同的世界结局。

当前为 0.5 可玩原型：16 个出生词条、地水风火四种初始符号、7 组可跨局对照的观察、10 个关键事件和 8 种世界结局。沿用同一开局可以改点复验；已见异常会出现具体调查入口，身份延续后的名单、副本调查将影响风暴救援和世界后果。

## 本地开发

需要 Node.js 22 或更新版本、Python 3。应用没有第三方运行依赖，也不需要 API key、后端或构建步骤。

```bash
npm start
```

服务根目录为 `docs/`，默认监听本机 8000 端口。使用 HTTP 访问，不能通过直接打开 HTML 文件运行 ES 模块与 JSON 加载。

```bash
npm test
```

规则测试覆盖所有结局的可达性、行动净变化、词条继承、条件判定、确定性重现和存档恢复。

在当前开发环境中还可运行真实浏览器检查（已提供 Playwright 和 `/usr/bin/chromium`）：

```bash
node tests/browser-smoke.cjs
```

可使用 `AI_PREVIEW_URL` 指定本地待测地址，用 `AI_BROWSER_RESULTS` 指定截图目录。默认输出在仓库外的 `/workspace/ai-dev-tools/results/discovery-ui`。浏览器检查覆盖三种配色、完整短局与长局、最近三项选择、生效值、全部事件与结局、手记与周期索引、键盘操作和存档恢复。

## 当前设计与迭代

[项目设计依据](DESIGN_FOUNDATION.md) 说明玩家体验、原稿交互意图、发现过程与后续验证方法；现有实现作为可供检验的原型。

默认晨雾使用原稿式紧凑清单：稀有度颜色、最近三项替换、手动或随机加点。观察与已验证规律分别保存；沿用开局控制实验条件，普通推进减少熟练后的重复操作。调查标明消耗与封存时刻，救援选择呈现不同代价，旧承诺会影响后续正文和结局。详见 [DESIGN.md](DESIGN.md)、[本轮迭代记录](DESIGN_PROGRESS.md) 和 [资料来源](UI_RESEARCH.md)。

[DESIGN_ITERATIONS.md](DESIGN_ITERATIONS.md)、`design/iterations/` 与 [旧方案对比页](docs/design-lab.html) 保留此前十轮界面实验。其报告、截图和测量脚本针对当时版本，不是当前规则的检查结果；本轮使用 `npm test` 与 `tests/browser-smoke.cjs` 验证，实际结果见 [0.5 验证记录](design/v0.5-validation.json)。

## GitHub Pages

保持现有静态站点结构：Pages 使用 `main` 分支的 `/docs` 目录即可，无需构建。若仓库已采用这一发布源，推送 `main` 后会沿用现有 Pages 发布流程；不额外更换发布分支或托管服务。对应项目站点地址通常为 `https://duffygod.github.io/ai/`，最终以仓库 Pages 设置显示的地址为准。

所有样式、脚本和故事内容随站点发布，使用相对路径，支持 `/ai/` 这样的项目子路径，不依赖 Tailwind CDN。`.nojekyll` 使内容按静态文件直接提供。CI 会在推送和 PR 时运行规则检查。

## 文件分工

- `docs/index.html`、`docs/css/world.css`：入口与本地样式。
- `docs/js/worldApp.js`：页面、按钮交互与探索手记。
- `docs/js/worldEngine.js`：与界面、存储无关的纯规则。
- `docs/js/worldStorage.js`：版本化存档与跨局记录。
- `docs/data/worlds.json`：新版词条、事件、线索、结局与日常文本。
- `tests/`：规则和浏览器检查。
- `DESIGN_FOUNDATION.md`：体验、原稿意图与验证方法。
- `DESIGN.md`：当前玩法、发现链及含剧透的规则说明。
- `DESIGN_PROGRESS.md`：本轮改造与实际检查记录。
- `UI_RESEARCH.md`：布局、条件叙事与评估方法来源。
- `DESIGN_ITERATIONS.md`、`design/`：十轮改造的任务、实际测量与方案取舍。

原稿的其他模块和数据暂时保留作为后续迁移的参考，新版入口只加载 `worldApp.js` 及其依赖。原稿存档与新版记录使用不同的键，原稿记录不会被覆盖。

## 游玩记录

当前进程、已发现规律与线索、已抵达结局和继承词条保存在浏览器本地。新规则使用独立 v3 存档，旧版当前局仍可从菜单进入原规则页面继续；旧发现和结局会保留。刷新后可从主菜单继续，关键事件也能恢复。更换设备、清理站点数据或更换预览域名会影响记录的可用性；本版没有云同步。
