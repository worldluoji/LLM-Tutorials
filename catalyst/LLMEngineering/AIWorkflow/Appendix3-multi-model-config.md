# Multi Model config
在 Claude Code 中配置多个不同地址的模型并实现快速切换，主要有三种方案，你可以根据自己的技术背景和需求来选择。

### ⚙️ 方案一：使用专用管理工具（推荐）

这是最推荐、也最便捷的方式，适合大多数用户。这些工具能帮你把配置集中管理，实现一键切换。

| 工具名称 | 安装命令 | 核心特点 | 适用场景 |
| :--- | :--- | :--- | :--- |
| **cc-manager** | `npm install -g @diogoparente/cc-manager` | 通过交互式向导创建配置(profile)，一条命令切换 | 需要在不同API提供商(Anthropic, OpenAI等)或个人/工作项目间切换 |
| **cc-switch-config** | `npm install -g cc-switch-config` | 支持**项目级**配置，进入目录可自动切换 | 同时维护多个项目，且每个项目使用不同API配置 |
| **@wcldyx/claude-code-switcher** | `npm install -g @wcldyx/claude-code-switcher` | 提供图形化选择界面，支持保存启动参数 | 偏好可视化操作，需要管理多个账号或第三方API |
| **claude-model-switch** | (VS Code扩展) | 在VS Code中按项目管理配置，状态栏显示当前模型 | 在VS Code中使用Claude Code，希望界面内切换 |

**操作示例（以 `cc-manager` 为例）：**

1.  **安装**：在终端运行 `npm install -g @diogoparente/cc-manager`。
2.  **创建配置**：运行 `cc-manager create my-profile`，然后根据交互提示输入`API Provider`、`API Key`、`Base URL`等信息。
3.  **切换配置**：运行 `cc-manager use my-profile`，即可一键切换。之后启动的 Claude Code 会话将使用新配置。

> **注意**：`cc-switch-config` 这类工具会修改项目目录下的 `.claude/settings.local.json` 文件，其优先级高于全局配置。

### 🛠️ 方案二：基于环境变量的配置

如果你熟悉命令行操作，可以通过设置环境变量来临时切换模型。这种方式适合快速测试。

1.  **设置环境变量**：在启动 Claude Code 前，在终端设置以下变量：
    *   `ANTHROPIC_BASE_URL`：指向你的 API 地址。
    *   `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`：对应的 API 密钥。
    *   `ANTHROPIC_MODEL`：指定默认使用的模型名称。

2.  **启动**：在同一个终端会话中运行 `claude` 命令。
    ```bash
    # 示例：使用 DeepSeek
    export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
    export ANTHROPIC_API_KEY="your-deepseek-api-key"
    export ANTHROPIC_MODEL="deepseek-chat"
    claude
    ```

**快速切换技巧**：可以在你的 shell 配置文件（如 `~/.zshrc` 或 `~/.bashrc`）中为不同模型创建别名或函数。
```bash
# 在 ~/.zshrc 中添加
function claude-deepseek() {
    ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic" \
    ANTHROPIC_API_KEY="your-deepseek-key" \
    ANTHROPIC_MODEL="deepseek-chat" \
    claude
}
```
之后，只需在终端输入 `claude-deepseek` 即可快速启动。

### 📄 方案三：直接编辑配置文件

这是最基础的方法，适合对配置有精确控制需求的用户。Claude Code 的配置文件位于 `~/.claude/settings.json`。

你可以在 `settings.json` 中通过 `env` 字段来指定环境变量。切换模型时，你需要手动编辑此文件，修改对应的值。虽然不够“快速”，但能让你清晰地了解配置的结构。

> **提示**：Claude Code 本身也支持在会话中使用 `/model` 命令切换。但需注意，**`/model`命令仅用于切换模型名称，无法更改API地址(`ANTHROPIC_BASE_URL`)**。要更改地址，必须通过上述三种方式之一修改环境变量或配置文件。

### 💎 总结

*   **追求极致便利**：首选**方案一**，使用专用管理工具实现一键切换。
*   **熟悉命令行且需求简单**：选择**方案二**，通过环境变量或 Shell 别名快速启动。
*   **需要精确控制或排查问题**：可以采用**方案三**，直接编辑配置文件。

你可以根据自己的习惯，选择最适合的一种或组合使用。