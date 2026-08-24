import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { config } from "dotenv";
import path from "node:path";
config({ path: ".env.local", override: true });

import { parseContractTool } from "../tools/contract-parse-tool.js";
import { classifyContractTool } from "../tools/contract-classify-tool.js";

// A Models collection with every built-in provider registered
const models = builtinModels();

async function main() {
  const cwd = process.cwd();
  const agentDir = path.join(cwd, ".pi-agent");
  const sessionDir = path.join(cwd, ".pi-sessions");

  const { session } = await createAgentSession({
    model: models.getModel("minimax-cn", "MiniMax-M3"),
    thinkingLevel: "medium",
    cwd,
    agentDir,
    sessionManager: SessionManager.create(cwd, sessionDir),
    customTools: [parseContractTool, classifyContractTool],
    tools: ["read", "parse_contract", "classify_contract"]
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
    "请按以下步骤审查 simple-contract.txt：" +      
    "1. 使用 contract-parse-tool 解析合同文件；" +      
    "2. 使用 contract-classify-tool 对合同进行分类；" +      
    "3. 基于分类结果，识别该类型合同的高风险条款并给出修改建议。"
  );
}

main().catch((err) => {  
    console.error("[运行错误]", err);  
    process.exit(1);
});