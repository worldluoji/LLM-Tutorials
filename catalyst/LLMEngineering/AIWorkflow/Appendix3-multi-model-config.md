# Multi Model config
现在的配置直接把模型和 Base URL 写死在了全局 `env` 里，相当于整个 CLI 只认一个模型。要支持随时换模型，**真正的做法是在配置里定义多个“模型块”，每个模型单独绑定自己的 Key、URL 和 Provider**。

下面给你一套**完整、可一键切换的多模型配置**，同时保留了你原有的超时、网络优化等设置。

---

### 完整配置（替换你目前的 `~/.claude/settings.json`）

```json
{
  "env": {
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": 1
  },
  "models": [
    {
      "id": "MiniMax-M3",
      "provider": "anthropic",
      "apiKey": "${MINIMAX_API_KEY}",
      "baseURL": "https://api.minimaxi.com/anthropic",
      "setAsDefault": true
    },
    {
      "id": "qwen-max",
      "provider": "openai-compatible",
      "apiKey": "${QWEN_API_KEY}",
      "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1"
    },
    {
      "id": "deepseek-chat",
      "provider": "openai-compatible",
      "apiKey": "${DEEPSEEK_API_KEY}",
      "baseURL": "https://api.deepseek.com/v1"
    }
  ]
}
```

> **说明：**
> - `MiniMax-M3` 用的是 Anthropic 协议，`qwen-max` 和 `deepseek-chat` 用的都是 OpenAI 兼容协议（`openai-compatible`）。  
> - 每个模型的 `apiKey` 使用 `${变量名}` 引用环境变量，**绝不把真实 Key 写死在文件里**。  
> - `setAsDefault: true` 放在 MiniMax-M3 上，这样不指定模型时默认就是它（跟你原来的行为一致）。

---

### 本地环境变量一次性设置

在你的 `~/.zshrc` 或 `~/.bashrc` 里写上：

```bash
export MINIMAX_API_KEY="你的MiniMax Key"
export QWEN_API_KEY="你的千问 Key"
export DEEPSEEK_API_KEY="你的DeepSeek Key"
```

然后执行 `source ~/.zshrc`（或重开终端）使之生效。

---

### 随时切换模型，一行命令搞定

之后想临时换模型，只需要在启动时传 **`--model`** 参数，完全不用动配置：

```bash
# 用千问
claude --model qwen-max

# 用 DeepSeek
claude --model deepseek-chat

# 默认 MiniMax（不传参数就是这个）
claude
```

如果你更喜欢用环境变量控制，也可以：

```bash
ANTHROPIC_MODEL=qwen-max claude
```

---

### 永久修改默认模型（不改文件）

如果某段时间你想让默认模型变成千问，不需要改配置文件，改环境变量即可：

```bash
export ANTHROPIC_MODEL=qwen-max
```

之后直接敲 `claude` 就会用千问。想换回来就 `export ANTHROPIC_MODEL=MiniMax-M3`。

---

### 快捷别名（老司机必备）

```bash
alias cq='claude --model qwen-max'
alias cds='claude --model deepseek-chat'
alias cm='claude --model MiniMax-M3'
```

之后 `cq` 就是千问，`cds` 就是 DeepSeek，`cm` 是 MiniMax，丝般顺滑。


这样配置后，你永远不需要再打开 `settings.json` 改模型，切换全在终端瞬间完成。