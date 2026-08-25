import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { config } from "dotenv";
import path from "node:path";
import { promises as fs } from "node:fs";
config({ path: ".env.local", override: true });

import { parseContractTool } from "../tools/contract-parse-tool.js";
// import { classifyContractTool } from "../tools/contract-classify-tool.js"; 不使用该工具，skill识别

import { reviewWithSkill } from "../review/skill-chunked-review.js";

// A Models collection with every built-in provider registered
const models = builtinModels();
// models.getModel("minimax-cn", "MiniMax-M3")

async function main() {
  const cwd = process.cwd();
  const agentDir = path.join(cwd, ".pi-agent");
  const sessionDir = path.join(cwd, ".pi-sessions");
  const filePath = process.argv[2] ?? "simple-contract.txt";
  const text = await fs.readFile(filePath, "utf-8");

  const { session } = await createAgentSession({
    model: models.getModel("minimax-cn", "MiniMax-M3"),
    thinkingLevel: "medium",
    cwd,
    agentDir,
    sessionManager: SessionManager.create(cwd, sessionDir),
    customTools: [parseContractTool],
    tools: ["read", "parse_contract"]
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

  const result = await reviewWithSkill(session, text);

  console.log("\n\n=== 审查结果 ===");
  console.log(`总体评分: ${result.score}`);
  console.log(`风险概览: ${result.summary}`);
  console.log(`风险总数: ${result.risks.length}`);

  for (const risk of result.risks.slice(0, 10)) {
    console.log(`\n[${risk.level}] ${risk.type} — ${risk.clause}`);
    console.log(`原文: ${risk.originalText.slice(0, 80)}...`);
    console.log(`建议: ${risk.suggestion.slice(0, 100)}...`);
  }
}

main().catch((err) => {  
    console.error("[运行错误]", err);  
    process.exit(1);
});