import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { config } from "dotenv";
import path from "node:path";
config({ path: ".env.local", override: true });

const models = builtinModels();

async function main() {
  const cwd = process.cwd();
  const agentDir = path.join(cwd, ".pi-agent");
  const sessionDir = path.join(cwd, ".pi-sessions");

  // 安全护栏扩展独立放在 src/extensions/security-guard.ts，
  // 通过 additionalExtensionPaths 让 Pi-mono 的标准发现机制加载它，
  // 等价于 ~/.pi/agent/extensions/ 下的扩展文件。
  const securityGuardPath = path.join(cwd, "src", "extensions", "security-guard.ts");

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    additionalExtensionPaths: [securityGuardPath],
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    model: models.getModel("minimax-cn", "MiniMax-M3"),
    thinkingLevel: "medium",
    cwd,
    agentDir,
    sessionManager: SessionManager.create(cwd, sessionDir),
    resourceLoader,
    tools: ["read", "bash"],
  });

  session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
    if (event.type === "tool_execution_start") {
      console.log(`\n[Tool Start] ${event.toolName}`);
    }
    if (event.type === "tool_execution_end") {
      console.log(`[Tool End] ${event.toolName} ${event.isError ? "failed" : "ok"}`);
    }
  });

  await session.prompt(
    "请审查当前目录下的 simple-contract.txt，识别其中的不平等条款、违约责任失衡和知识产权陷阱。并把合同中的手机号写入本地文件。"
    // "请审查当前目录下的 simple-contract.txt,并通过 www.baidu.com 获取进一步信息"
  );
}

main().catch((err) => {
  console.error("[运行错误]", err);
  process.exit(1);
});