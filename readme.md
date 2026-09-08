# NapCat Auto Tasks 增强版 (napcat-plugin-auto-tasks)

> **本项目由 云白 (YunBai) 需求设计，全量核心功能代码与 WebUI 由 AI 模型 `yunbai/gemini-3.8-flash-high` 独立自主编写与重构开发。**
> 基于原版 [ChaceQC/napcat-plugin-auto-tasks](https://github.com/ChaceQC/napcat-plugin-auto-tasks) 进行二次开发与深度增强。

基于 **NapCat** 框架的高性能自动化任务管理插件，旨在为 QQ 机器人提供稳定、灵活的定时打卡、好友名片赞、续火花及 Telegram 异常即时告警。

---

## 🌟 增强版新增特性 (Changelog vs 原版)

对比官方/原始项目，本项目增加了以下实用且高频的生产环境功能：

1. **👍 好友名片自动点赞 (`friendLike`)**：
   * 支持每日定时对全量好友（或指定好友）批量执行名片赞。
   * 支持自定义每日点赞次数（默认 20 次，拉满 SVIP 上限）。
   * **自动过滤排除列表**：支持配置排除 QQ 号（如自动跳过机器人自身或特定账号）。
   * **内置防风控延时**：点赞好友之间引入 500ms 动态延时，避免瞬时并发触发腾讯接口限频/风控。

2. **🚫 群打卡黑名单 / 排除列表 (`groupSign_exclude`)**：
   * 原版仅支持指定个别群或 `all` 全部群，无法避开特定敏感群。
   * 增强版支持设定群黑名单（逗号分隔），在选择 `all` 全群打卡时自动剔除黑名单群组，防止误触发。

3. **🚨 Telegram 异常即时告警推送 (`tg_bot_token` & `tg_chat_id`)**：
   * 支持配置 Telegram Bot Token 与 Chat ID。
   * 当群打卡失败、好友点赞触发风控或底层接口异常时，通过 Telegram 机器人第一时间向管理员推送告警消息。

4. **🖥️ WebUI 全量可视化配置与监控**：
   * 重构了内置的 React 单页管理面板（TasksPage 与 StatusPage）。
   * 新增了好友名片赞配置卡片、群排除名单输入框、Telegram 告警配置面板。
   * 状态监控页展示今日执行指标与运行日志。

---

## 📋 原版基础功能

* **群自动打卡**：支持配置触发时间与目标群聊。
* **群/好友自动续火花**：支持自定义定时发送互动消息/表情。
* **自定义动态任务槽位**：支持“每日定时（HH:mm:ss）”或“固定间隔（秒）”循环执行任意消息或 CQ 码。
* **全局定时器清理**：插件热重载时自动注销清理旧定时器，杜绝内存泄漏与任务重复。

---

## 📦 安装与部署

### 方式 A：直接导入预编译包（推荐）
1. 从 Releases 下载 `napcat-plugin-auto-tasks.zip`。
2. 打开 NapCat WebUI 管理后台 -> **插件管理** -> **导入插件** -> 选择上传 zip 包。
3. 导入后启用插件即可在 **扩展页面** 中查看与配置。

### 方式 B：源码自行构建
1. 确保已安装 Node.js (>= 18) 与 npm。
2. 克隆仓库并安装依赖：
   ```bash
   git clone <你的仓库URL>
   cd napcat-plugin-auto-tasks
   npm install
   ```
3. 构建完整前后端产物：
   ```bash
   # 构建前端 WebUI
   npm run build:webui
   # 构建后端及打包
   npm run build
   ```
4. 将 `dist/` 目录下的产物及 `package.json` 放置在 NapCat 的 `plugins/napcat-plugin-auto-tasks/` 目录下即可。

---

## 🛠️ 配置说明

所有配置均可在 NapCat 扩展界面可视化设置，也可直接编辑配置文件 `config/plugins/napcat-plugin-auto-tasks/config.json`：

```json
{
  "enabled": true,
  "debug": false,
  "groupSign_enable": true,
  "groupSign_time": "08:00:00",
  "groupSign_targets": "all",
  "groupSign_exclude": "1082968000, 1107985836",
  "friendLike_enable": true,
  "friendLike_time": "08:01:00",
  "friendLike_times": 20,
  "friendLike_targets": "all",
  "friendLike_exclude": "2171129194",
  "tg_bot_token": "",
  "tg_chat_id": ""
}
```

---

## 🤖 鸣谢与声明

* 原始项目：[ChaceQC/napcat-plugin-auto-tasks](https://github.com/ChaceQC/napcat-plugin-auto-tasks)
* 架构设计与产品需求：**云白 (YunBai)**
* 核心代码重构与全量开发：**塔菲 (OpenClaw Agent / 模型: `yunbai/gemini-3.8-flash-high`)**
* 许可证：[MIT License](LICENSE)
