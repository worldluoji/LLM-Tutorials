/**
 * src/main.ts
 *
 * node-tiny-claw 的入口：组装 Provider / Registry / Tools / Engine / Reporter，
 * 然后用一句话 prompt 启动 Agent。
 *
 * 运行：`pnpm start`
 *
 * 设计要点：
 * - 工作区 = cwd/workspace，借鉴 OpenClaw 物理边界理念
 * - Reporter 按"每次 Run 调用传入"——不是 Engine 字段。这跟 Go `eng.Run(ctx, prompt, reporter)` 一致。
 */
import 'dotenv/config';
import path from 'node:path';
import { logger } from './utils/logger.ts';
import { AgentEngine } from './engine/loop.ts';
import { newTerminalReporter } from './engine/terminal_reporter.ts';
import { globalSessionMgr } from './engine/session.ts';
import { MiniMaxProvider } from './llm/minimax-provider.ts';
import { RegistryImpl } from './tools/registry.ts';
import { BashTool } from './tools/bash.ts';
import { ReadFileTool } from './tools/read-file.ts';
import { WriteFileTool } from './tools/write-file.ts';
import { EditFileTool } from './tools/edit-file.ts';

async function main(): Promise<void> {
  // 1. 环境变量校验
  if (!process.env.MINIMAX_API_KEY) {
    logger.fatal('请先导出 MINIMAX_API_KEY 环境变量');
    process.exit(1);
  }

  // 2. 工作区路径：cwd/workspace
  const workDir = path.join(process.cwd(), 'workspace');

  // 3. 实例化 LLM Provider
  const llmProvider = new MiniMaxProvider('MiniMax-M3');

  // 4. 工具注册表 + 注册 4 个工具
  const registry = new RegistryImpl();
  registry.register(new ReadFileTool(workDir));
  registry.register(new WriteFileTool(workDir));
  registry.register(new BashTool(workDir));
  registry.register(new EditFileTool(workDir));

  // 5. 引擎 + 终端 reporter + Session
  const eng = new AgentEngine(llmProvider, registry, workDir, true);
  const reporter = newTerminalReporter();
  // CLI 默认一个固定 session id；多终端隔离可改为目录哈希或终端 PID。
  const session = globalSessionMgr.getOrCreate('cli-default', workDir);

  const prompt = `
    我需要在当前目录下新建一个 ping.ts，提供一个简单的 http ping 接口。
    写完之后，帮我把代码用 git 提交一下。
    `;

  try {
    await eng.run(session, prompt, undefined, reporter);
  } catch (err) {
    logger.fatal(`引擎运行崩溃: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();