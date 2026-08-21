import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { config } from "dotenv";
import path from "node:path";
config({ path: ".env.local", override: true });

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
    "请审查当前目录下的 simple-contract.txt，识别其中的不平等条款、违约责任失衡和知识产权陷阱。"
  );
}

main().catch(console.error);