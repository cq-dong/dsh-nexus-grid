# Nexus Grid · 会话雷达

[![powered by dsh](https://img.shields.io/badge/powered%20by-DSH-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)

Nexus Grid 是一个 DeepSeek Harness（DSH）插件。打开左侧的 **会话雷达**，即可在同一页面查看正在运行和等待你操作的会话，不必在侧栏来回切换。

## 安装

在 DSH 桌面端打开 **插件 → 添加插件**，在安装来源中输入以下 Git 地址：

```text
git+https://github.com/cq-dong/dsh-nexus-grid.git#v0.1.0
```

启用插件后，在左侧导航打开 **会话雷达**。如果左侧没有显示入口，请检查「更多」和插件启用状态。本版按 DSH `0.2.2-rc.5` 的接口开发；完整桌面交互仍待验收。

## 怎么用

| 场景 | 会话雷达的行为 |
| --- | --- |
| 正在运行或等待操作 | 自动加入分屏；首次入场时等待操作的会话优先。 |
| 会话结束 | 保留原格，标记「已结束」。可单独移除，也可批量清理。 |
| 没有活跃会话 | 显示待机页。勾选最近会话，再点「将选中会话加入分屏」。 |
| 会话超过六个 | 每页最多挂载六格，可翻页查看其余会话。窄窗口会减少列数。 |

每格尝试复用 DSH 的原生会话界面，操作权限仍由 DSH 决定。插件不额外调用模型，不把会话发送给外部服务，也不为发现会话启用后台轮询。页面内的分屏选择不是跨重启保存的布局。

## 开发与反馈

需要 Node.js 20 或更新版本，无需安装第三方依赖即可运行检查：

```bash
npm run check
npm pack --dry-run
```

报告问题时，请附上 DSH 版本、系统、复现步骤和预期行为；请不要粘贴私密聊天内容或凭据。反馈入口：[GitHub Issues](https://github.com/cq-dong/dsh-nexus-grid/issues)。

许可证：[MIT](LICENSE)。
