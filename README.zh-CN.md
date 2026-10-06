# rpiv-ask-user-question — 维护 fork

[English](README.md) | 中文

Pi 的 `ask_user_question` 结构化提问扩展，用于请求信息不足、关键决定会影响实施范围或验收时向用户提供明确选项。维护仓：<https://github.com/chenhaoxiang/rpiv-ask-user-question>。

## 发布版本与分支约定

当前维护版本为 **0.1.4-fork.1**，基于社区 **0.1.4**。fork 版本统一使用 `<社区版本>-fork.<修订号>`，本地修订不冒充社区新版本。

- `main`：我们的维护、整合与发布主线，保留 fork 修复。
- `upstream-main`：仅镜像社区 `main`，不加入 fork 提交，也不作为安装来源。
- 改动通过经过审核的 PR 合入 `main`；保留现有分支和历史。

固定版本安装：

```bash
pi install git:github.com/chenhaoxiang/rpiv-ask-user-question@v0.1.4-fork.1
```

[GitHub Releases](https://github.com/chenhaoxiang/rpiv-ask-user-question/releases) 提供可安装的包、来源清单和 `SHA256SUMS` 校验文件；这不是向上游作者的 npm 命名空间发布。发布及制品安装流程见[维护说明](docs/releasing.md)。

原先未区分社区/fork 的包版本 `0.1.6`，按真实社区基线规范为 `0.1.4-fork.1`。这是命名归一，不回退自由文本编辑或宿主 import 修复。

## 安装本 fork

需要跟踪维护主线时：

```bash
pi install git:github.com/chenhaoxiang/rpiv-ask-user-question@main
```

上游 npm 包与本 fork 是不同来源；固定版本安装见上文。安装后重启或 `/reload`。

## 工具行为

```ts
ask_user_question({
  question: "保留哪种实现？",
  header: "实现方案",
  options: [
    { label: "小补丁", description: "保留现有架构" },
    { label: "重构", description: "把行为迁入共享模块" }
  ],
  multiSelect: false
})
```

界面提供可选择的选项及说明、带可编辑行内文本的 **Other**、不强迫归类选择的 **Chat about this**，并支持键盘导航、光标移动、多行输入、bracketed paste 与取消。结构化结果保留原问题、选择、自由回答或继续对话标记。

返回结果分别表达：已选选项、自由文本回答（包括明确的 `(no input)`）、希望继续讨论、用户拒绝、非交互模式 UI 不可用、选项列表为空。

## 何时使用

只有缺少具体决定且会影响实施、范围、外部契约或验收时才提问；可安全自行决定的低风险、可回退细节，不应反复让用户确认。结构化选项比要求用户输入散乱回答更易保留决策上下文。提问工具不能绕过项目或平台安全边界。

## 兼容性与限制

- 只使用 Pi 公共 API 和宿主提供的 `@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui`、`typebox`；
- 选择器需要交互式 UI；print/RPC 无 UI 时明确返回不可用，不猜测答案；
- 不写全局配置、凭据、提示词或 Pi 正常工具结果机制之外的会话文件；
- `multiSelect` 保留在公开 schema 中以维持工具协议，但不应仅凭该字段声称已实现多选界面。选项与自由输入使用同一个提问对话框。

## 开发与验证

```bash
npm install --ignore-scripts
```

当前没有自动化功能测试脚本。发布检查覆盖运行文件、打包内容及不调用模型的隔离 RPC 加载；真实交互选择器与自定义回答路径仍需手工 UI 验证。不要运行不存在的 `npm test`，也不要用生产凭据或私人会话作为 fixture。

## 许可证

MIT
