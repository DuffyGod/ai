# 颜色认知挑战 (Color Cognitive Challenge)

这是一个基于 Web 的颜色认知挑战游戏，旨在锻炼专注力和反应速度。

## 项目结构

- `docs/`: 包含所有静态文件（HTML, CSS, JS），可直接用于部署。
  - `index.html`: 入口文件。
  - `css/`: 样式文件。
  - `js/`: JavaScript 逻辑代码。

## 如何部署到 GitHub Pages

本项目已经配置为可以直接部署到 GitHub Pages。请按照以下步骤操作：

1.  **提交代码到 GitHub**
    确保你已经将所有代码（包括 `docs/` 目录）提交并推送到你的 GitHub 仓库。

2.  **配置 GitHub Pages**
    - 进入你的 GitHub 仓库页面。
    - 点击顶部的 **Settings** (设置) 选项卡。
    - 在左侧菜单中找到并点击 **Pages**。
    - 在 **Build and deployment** 部分：
        - **Source**: 选择 `Deploy from a branch`。
        - **Branch**: 选择 `main` (或你当前使用的分支)。
        - **Folder**: 选择 `/docs` 文件夹（**重要**：不要选 `/ (root)`，因为项目文件都在 `docs` 目录下）。
    - 点击 **Save** 保存设置。

3.  **访问你的网站**
    保存后，GitHub 会开始构建你的页面。稍等片刻（通常几分钟内），刷新 Pages 设置页面，你将看到你的网站地址（通常是 `https://<你的用户名>.github.io/<仓库名>/`）。

## 本地开发

如果你想在本地运行：

1.  克隆仓库到本地。
2.  直接在浏览器中打开 `docs/index.html` 文件即可运行（某些功能可能受限于 `file://` 协议，建议使用本地服务器）。
3.  或者使用简单的 HTTP 服务器，例如 Python：
    ```bash
    cd docs
    python3 -m http.server
    ```
    然后访问 `http://localhost:8000`。

## 技术栈

- HTML5
- Tailwind CSS (通过 CDN 引入)
- Vanilla JavaScript (ES6 Modules)
