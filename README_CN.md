# 社区与家庭管理小程序 (Community & Family Management Mini Program)

本项目是一个功能强大的微信小程序，旨在促进社区互动、家庭/群组管理和内容分享。它基于 [TDesign Miniprogram Starter](https://github.com/TDesignOteam/tdesign-miniprogram-starter) 构建，并利用微信云开发（云函数与数据库）作为 Serverless 后端。

## 🌟 核心功能

### 👤 用户与社交
*   **用户档案**：支持自定义编辑的个人主页。
*   **社交动态 (首页)**：浏览动态、查看详情并进行互动。
*   **互动**：支持点赞、评论和内容搜索功能。
*   **通知系统**：实时的互动与更新通知。
*   **聊天**：集成的聊天界面 (`pages/chat`)。

### 👨‍👩‍👧 家庭/群组管理
*   **家庭中心**：专门的家庭或群组列表页面 (`pages/family`)。
*   **家庭详情**：特定家庭群组的详细视图 (`pages/family-detail`)。
*   **管理工具**：管理家庭成员和设置 (`cloudfunctions/manageFamily`)。

### 🛡️ 认证与安全
*   **身份验证**：个人和家庭认证的工作流 (`pages/verify`)。
*   **内容安全**：通过 `contentCheck` 云函数自动过滤文本和图片，确保符合平台规范。

### 🔧 管理后台
*   **认证审批**：管理员审核批准认证请求的界面 (`pages/admin/verify`)。
*   **Banner 管理**：管理首页轮播图 (`pages/admin/banner-manager`)。

### 📸 其他功能
*   **照片墙**：分享生活瞬间的视觉画廊 (`pages/photowall`)。
*   **数据中心**：统计与分析视图 (`pages/dataCenter`)。

## 🛠 技术栈

*   **前端**：微信小程序 (WXML, WXSS, JavaScript/JSON)
*   **UI 框架**：[TDesign Miniprogram](https://tdesign.tencent.com/miniprogram)
*   **后端**：微信云开发 (Serverless)
    *   **云函数**：Node.js
    *   **数据库**：云数据库 (NoSQL)
    *   **存储**：云存储 (用于图片/媒体)

## 📂 项目结构

```text
├── cloudfunctions/             # 后端逻辑 (Node.js)
│   ├── adminAction/            # 管理员操作
│   ├── contentCheck/           # 文本/图片安全过滤
│   ├── getNotifications/       # 获取用户通知
│   ├── getPosts/               # 获取社区动态
│   ├── manageFamily/           # 家庭群组增删改查
│   ├── managePost/             # 动态创建与删除
│   ├── manageReaction/         # 点赞与互动处理
│   ├── submitVerification/     # 处理用户认证请求
│   └── ...
├── components/                 # 可复用 UI 组件
│   ├── card/                   # 通用卡片组件
│   ├── post-card/              # 动态展示组件
│   ├── post-skeleton/          # 加载骨架屏
│   └── ...
├── pages/                      # 应用页面
│   ├── admin/                  # 管理后台
│   ├── family/                 # 家庭列表页
│   ├── home/                   # 首页信息流
│   ├── login/                  # 认证登录页
│   ├── my/                     # 个人中心与设置
│   ├── notifications/          # 通知中心
│   ├── photowall/              # 照片墙
│   ├── verify/                 # 认证表单
│   └── ...
├── static/                     # 静态资源 (图片, 图标)
├── app.js                      # 小程序入口
├── app.json                    # 全局配置
└── project.config.json         # 项目设置
```

## 🚀 快速开始

### 前置要求
*   安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
*   安装 Node.js & npm

### 安装步骤

1.  **克隆/下载** 本仓库。
2.  **安装依赖**：
    在项目根目录打开终端并运行：
    ```bash
    npm install
    ```
3.  **构建 NPM**：
    在微信开发者工具中，点击菜单栏 `工具` -> `构建 npm`。

### 云开发配置

1.  **开通云开发**：在开发者工具中，点击“云开发”按钮开通环境。
2.  **上传云函数**：
    *   右键点击 `cloudfunctions` 文件夹。
    *   选择当前的云环境。
    *   选择 “上传并部署：云端安装依赖”。
3.  **数据库初始化**：
    *   查看 `cloudfunctions/initDb` (如果有) 或手动创建应用所需的集合 (如 `posts`, `users`, `families`, `notifications`)。

## 🤝 贡献

欢迎提交贡献！在提交 PR 之前，请确保在微信开发者工具模拟器中测试通过。

## 📄 许可证

本项目基于 TDesign Starter (MIT License)。
