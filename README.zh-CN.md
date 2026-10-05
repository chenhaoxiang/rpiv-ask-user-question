# rpiv-ask-user-question — 维护 fork

[English](README.md) | 中文

一个 Pi 扩展，提供 `ask_user_question` 结构化提问工具，用于当前请求不足以安全决策、不能靠猜测继续时向用户提问。

维护 fork 仓库：

<https://github.com/chenhaoxiang/rpiv-ask-user-question>

## 安装本 fork

```bash
pi install git:github.com/chenhaoxiang/rpiv-ask-user-question@main
```

需要可复现安装时，可固定审核过的提交：

```bash
pi install git:github.com/chenhaoxiang/rpiv-ask-user-question@<reviewed-commit>
```

安装后重启 Pi 或执行 `/reload`。

## 工具行为

扩展注册一个工具：

```ts
ask_user_question({
  question: "Which implementation should we keep?",
  header: "Implementation",
  options: [
    { label: "Small patch", description: "Keep the existing architecture." },
    { label: "Refactor", description: "Move the behavior into a shared module." }
  ],
  multiSelect: false
})
```

工具会在 TUI 中展示结构化选项。用户可以选择一个或多个选项，也可以使用 `Other` 输入自由文本；工具返回结构化选择结果，便于模型继续执行而不是猜测用户意图。

## 适用场景

- 需求存在多个合理实现路径；
- 需要用户确认范围、优先级或兼容性；
- 继续操作会改变产品契约、文件范围或验收标准；
- 缺少一个关键决定，无法诚实地宣称已完成。

不应把它用作普通聊天问题，也不应用它绕过项目、平台或安全规则。

## 兼容性与边界

- 这是 Pi 扩展，不会修改 Pi 核心；
- 选项和回答只在当前提问流程中使用，不替用户持久化业务决策；
- `multiSelect` 控制是否允许多选；
- 始终提供 `Other` 自由文本入口；
- 用户取消或关闭提示时，调用会返回取消/未回答状态，由模型决定下一步是否需要再次提问。

## 开发

```bash
npm install
npm test
```

测试使用合成选项和本地 UI fixture，不需要 provider 凭据，也不读取私人会话内容。

## 许可证

MIT
