/**
 * src/main.ts
 *
 * node-tiny-claw 的入口：组装 Provider / Registry / Tools / Engine / Reporter，
 * 然后进入 REPL 循环读取用户输入作为 Agent 任务。
 *
 * 运行：`pnpm start`
 * 退出：输入 `exit` / `quit` / Ctrl-D
 *
 * 设计要点：
 * - 工作区 = cwd/workspace，借鉴 OpenClaw 物理边界理念
 * - Reporter 按"每次 Run 调用传入"——不是 Engine 字段。这跟 Go `eng.Run(ctx, prompt, reporter)` 一致。
 * - REPL 多轮复用同一个 Session：与教程 10. Session 的"会话隔离"思想一致，
 *   同一终端的多次提问共享上下文（不同终端用 sessionId 隔离）。
 * - 用 **队列 + 持久监听** 模式处理 stdin：rl.on('line') 一次性注册，把行推入队列，
 *   主循环 await drain —— 避免 `rl.once` 在长 await 期间被吞行（stdio pipe 场景尤为明显）。
 * - 用事件式 rl.on 而非 rl.question async：避免与 pino 的 stdout 写入互相打断，
 *   也避免 readline 在长 await 期间被 pino 的 fatal/error 流误关闭。
 */
import 'dotenv/config';
import path from 'node:path';
import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { logger } from './utils/logger.ts';
import { AgentEngine } from './engine/loop.ts';
import { newTerminalReporter } from './engine/terminal_reporter.ts';
import { globalSessionMgr } from './engine/session.ts';
import { MiniMaxProvider } from './llm/minimax-provider.ts';
import { CostTracker } from './llm/tracker.ts';
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

  // 3. 实例化 LLM Provider + 用 CostTracker 装饰（透明埋点）
  const modelName = 'MiniMax-M3';
  const rawProvider = new MiniMaxProvider(modelName);
  const session = globalSessionMgr.getOrCreate('cli-default', workDir);
  const llmProvider = new CostTracker(rawProvider, modelName, session);

  // 4. 工具注册表 + 注册 4 个工具
  const registry = new RegistryImpl();
  registry.register(new ReadFileTool(workDir));
  registry.register(new WriteFileTool(workDir));
  registry.register(new BashTool(workDir));
  registry.register(new EditFileTool(workDir));

  // 5. 引擎（构造一次，整轮 REPL 复用）
  const eng = new AgentEngine(llmProvider, registry, workDir, true);

  // 6. REPL 循环：事件式处理 stdin 输入
  const rl = readline.createInterface({ input, output, terminal: false });
  logger.info('🤖 node-tiny-claw 已启动 | 输入 exit/quit 或 Ctrl-D 退出');
  logger.info(`工作区: ${workDir} | Session: ${session.id}`);

  // 用闭包变量追踪 readline 是否已被关闭（Interface 类型不暴露 closed 字段）
  let rlClosed = false;
  rl.on('close', () => {
    rlClosed = true;
  });

  // ---------- stdin 行队列（持久监听 + 拉模型） ----------
  // 关键：rl.on('line') 一次注册，行推入 queue，主循环 await `readNextLine`。
  // 这样保证 `eng.run` 在长 await 期间到达的 stdin 行不会被吞，
  // 也避免 `rl.once` 反复注册带来的事件丢失。
  // 解析器仅做"唤醒"信号——不传值；readNextLine 通过 queue + rlClosed 双状态决定返回值。
  const lineQueue: string[] = [];
  let wakeWaiter: (() => void) | null = null;

  rl.on('line', (rawLine) => {
    lineQueue.push(rawLine);
    if (wakeWaiter) {
      const cb = wakeWaiter;
      wakeWaiter = null;
      cb();
    }
  });
  rl.on('close', () => {
    rlClosed = true;
    if (wakeWaiter) {
      const cb = wakeWaiter;
      wakeWaiter = null;
      cb();
    }
  });

  const readNextLine = async (): Promise<string | null> => {
    while (lineQueue.length === 0) {
      if (rlClosed) return null;
      await new Promise<void>((resolve) => {
        wakeWaiter = resolve;
      });
    }
    return lineQueue.shift()!;
  };

  // 主循环：写 prompt → 读一行 → 处理
  while (true) {
    output.write('\n> ');
    const rawLine = await readNextLine();
    if (rawLine === null) {
      // EOF（Ctrl-D 或 stdin 关闭）→ 静默退出
      if (!rlClosed) rl.close();
      break;
    }
    const prompt = rawLine.trim();
    if (prompt === 'exit' || prompt === 'quit') {
      logger.info('👋 Bye');
      rl.close();
      break;
    }
    if (prompt === '') {
      continue;
    }
    // 单轮执行：每次 run 用新 reporter 避免上轮输出混入
    const reporter = newTerminalReporter();
    try {
      await eng.run(session, prompt, undefined, reporter);
    } catch (err) {
      logger.error(
        `引擎本轮运行失败: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  logger.info('session 总成本: ¥' + session.totalCostCNY.toFixed(6));
}

main().catch((err) => {
  logger.fatal(`主程序崩溃: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
