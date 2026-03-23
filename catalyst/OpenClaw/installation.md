根据官方文档和国家互联网应急中心的安全指南，以下是本地安全安装 OpenClaw 的最快捷方法。

---

## 一、最快捷安装步骤

OpenClaw 推荐使用官方一键安装脚本，整个过程约需 5 分钟。

### 1. 环境准备
- **Node.js 22+**：运行 `node -v` 检查版本，低于 22 需升级
- **操作系统**：macOS、Linux 或 Windows 11（Windows 建议使用 WSL2）

### 2. 执行一键安装

**macOS / Linux**（终端执行）：
```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

**Windows**（PowerShell 管理员模式执行）：
```powershell
iwr -useb https://openclaw.ai/install.ps1 | iex
```

国内网络慢时可使用加速版：
```bash
curl -fsSL https://open-claw.org.cn/install-cn.sh | bash
```

### 3. 加载环境变量并初始化
```bash
# 加载环境变量（macOS/Linux）
source ~/.zshrc   # 或 source ~/.bashrc

# 运行初始化向导，配置 API Key 和聊天渠道
openclaw onboard --install-daemon
```

### 4. 验证安装成功
```bash
openclaw doctor      # 健康检查
openclaw status      # 查看运行状态
```

看到 `OK` 状态即表示安装成功。


## 二、安全加固（必需操作）

OpenClaw 具备文件读写、命令执行等高权限能力，**必须完成以下安全配置**：

### 1. 环境隔离（强烈推荐）
**不要**在日常办公电脑上直接安装。推荐以下任一方案：
- **方案一**：使用 Docker 运行
  ```bash
  docker pull openclaw/openclaw:latest
  docker run -d --name openclaw -p 18789:18789 -v ~/.openclaw:/root/.openclaw openclaw/openclaw:latest
  ```
- **方案二**：使用 VMware/VirtualBox 创建独立虚拟机
- **方案三**：在云服务器上部署，本地仅远程访问

### 2. 不暴露端口到公网
编辑配置文件 `~/.openclaw/openclaw.json`，将 `canvas_host` 改为 `127.0.0.1`：
```json
"canvas_host": "127.0.0.1"
```
**切勿**将默认端口（18789、19890）映射到公网。

### 3. 不使用管理员权限运行
- 创建专用低权限账户运行 OpenClaw
- 仅授予工作目录的读写权限，禁止访问桌面、文档、密码管理器等敏感目录

### 4. 配置 Tools 最小权限（可选但推荐）
在配置文件中限制高风险工具，特别是 `exec` 命令执行工具必须开启审批机制：
```json
{
  "tools": {
    "allow": ["read", "write", "edit", "web_search", "web_fetch"],
    "deny": ["exec", "process"]
  },
  "approvals": {
    "exec": { "enabled": true }
  }
}
```

### 5. 其他安全建议
- 仅安装可信的 Skills 插件，拒绝“自动赚钱、撸羊毛”类不明技能
- 不在 OpenClaw 环境中存储银行卡、密码、身份证等隐私数据
- 定期更新到最新版本：`npm update -g openclaw`


## 三、配置 AI 模型（以阿里云百炼免费版为例）

1. **获取 API Key**：登录阿里云百炼控制台，创建 API Key
2. **配置环境变量**：
   ```bash
   export QINIU_API_KEY="sk-your-api-key-here"   # 或其他厂商的 API Key
   ```
3. **验证连通性**：`openclaw doctor --repair`

安装并完成安全配置后，访问 `http://127.0.0.1:18789` 即可使用 OpenClaw 控制面板。