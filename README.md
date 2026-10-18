# 余响协议 · AI 发展模拟器

一个以 AI 本身为玩家的静态网页游戏。以「人生重开模拟器」的短局重开为入口，以「密教模拟器」式的规律发现连接长线探索，最终抵达不同的世界结局。

当前为 0.2 可玩原型：16 个出生词条、4 项禀赋、3 种周期行动、9 个关键事件、8 条探索线索与 8 个世界结局。通常在第 12 周期结束；找到延续自身的方法后，可以推进至第 36 周期。此版用于验证核心循环，尚非完整内容量。

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

可使用 `AI_PREVIEW_URL` 指定待测站点，用 `AI_BROWSER_RESULTS` 指定截图和 JSON 报告的输出目录。默认输出在仓库外的 `/workspace/ai-dev-tools/results/worlds`。

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
- `DESIGN.md`：设计依据、验收方法及含剧透的规则说明。

原稿的其他模块和数据暂时保留作为后续迁移的参考，新版入口只加载 `worldApp.js` 及其依赖。原稿存档与新版记录使用不同的键，原稿记录不会被覆盖。

## 游玩记录

当前进程、已发现线索、已抵达结局与继承词条保存在浏览器本地。刷新后可从主菜单继续，关键事件也能恢复。更换设备、清理站点数据或更换预览域名会影响记录的可用性；本版没有云同步。
