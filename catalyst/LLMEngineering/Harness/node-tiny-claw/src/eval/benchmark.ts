// benchmark.ts
// 极简版 Benchmark 引擎：跑一组 testcase 并产出可量化的"跑分报告"。
// 参考 SWE-bench 的"基于测试"评估范式（Fail-to-Pass）：每个用例 = 靶机准备 + Agent 执行 + 验证脚本。
//
// 设计要点（教程 19. Benchmark.md）：
// - 每个用例独立沙箱目录（物理隔离），避免污染与并发干扰。
// - Provider 通过工厂函数注入：生产用真实 MiniMaxProvider，测试用 MockProviderFactory。
// - 复用 CostTracker：把"成本"作为评估信号之一（与耗时、成功并列）。
// - 返回 TestResult[] 而非仅打印：测试可以断言，CI 可以入库做趋势分析。

import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

import { LLMProvider } from '../llm/llm-provider.ts';
import { CostTracker } from '../llm/tracker.ts';
import { AgentEngine } from '../engine/loop.ts';
import { Session } from '../engine/session.ts';
import { Role } from '../schema/message.ts';
import { RegistryImpl } from '../tools/registry.ts';
import { BashTool } from '../tools/bash.ts';
import { ReadFileTool } from '../tools/read-file.ts';
import { WriteFileTool } from '../tools/write-file.ts';
import { EditFileTool } from '../tools/edit-file.ts';
import { logger } from '../utils/logger.ts';

/**
 * 单个评测用例：靶机准备脚本 + Agent 任务指令 + 验证脚本。
 *
 * 关键设计：
 * - setupScript / validateScript 都用 bash 执行（与 SWE-bench 一致）；
 *   沙箱目录（sandboxDir）作为它们的 cwd。
 * - validateScript 是"客观断言"：return 0 = 通过；非 0 = 失败。
 * - 字段命名与 Go 版 BenchmarkRunner 对齐，便于双侧对照。
 */
export interface TestCase {
  id: string;
  name: string;
  taskPrompt: string;
  /** （可选）执行前的靶机准备脚本；在 sandboxDir 下执行 */
  setupScript?: string;
  /** 必填：Agent 跑完后执行的验证脚本；return 0 = Pass */
  validateScript: string;
}

/**
 * 单个用例的运行结果。
 */
export interface TestResult {
  testCaseId: string;
  passed: boolean;
  durationMs: number;
  totalCostCNY: number;
  /** 失败时填入错误描述（人类可读） */
  errorMsg?: string;
  /** 验证脚本的标准输出/错误混合（便于诊断失败原因） */
  validateOutput?: string;
}

/**
 * 构造 LLM Provider 的工厂函数类型。
 *
 * 为什么用工厂而非直接 new MiniMaxProvider(...)？
 * - 同一 Benchmark 中多次调用，可能需要按 modelName / 用例参数路由；
 * - 测试时注入 MockProviderFactory，跑分逻辑可单元化。
 */
export type ProviderFactory = (modelName: string) => LLMProvider;

/**
 * BenchmarkRunner 配置项。
 */
export interface BenchmarkOptions {
  /** Provider 工厂（必填） */
  providerFactory: ProviderFactory;
  /** 模型名（传给 factory） */
  modelName: string;
  /** 沙箱根目录；每个用例建子目录。默认 cwd + /workspace */
  workspaceRoot?: string;
  /** Agent 是否启用 thinking 模式；默认 false（评测要"快"且"稳"） */
  enableThinking?: boolean;
}

/**
 * BenchmarkRunner：跑一组用例并产出可量化的"跑分报告"。
 *
 * 用法：
 *   const runner = new BenchmarkRunner({ providerFactory, modelName: 'MiniMax-M3' });
 *   const results = await runner.runSuite(cases);
 */
export class BenchmarkRunner {
  private readonly opts: Required<BenchmarkOptions>;

  constructor(opts: BenchmarkOptions) {
    this.opts = {
      providerFactory: opts.providerFactory,
      modelName: opts.modelName,
      workspaceRoot: opts.workspaceRoot ?? path.join(process.cwd(), 'workspace'),
      enableThinking: opts.enableThinking ?? false,
    };
  }

  /**
   * 执行一组用例，返回每个用例的 TestResult 数组，并打印跑分终极报告。
   */
  async runSuite(testcases: TestCase[]): Promise<TestResult[]> {
    logger.info('==================================================');
    logger.info(`🚀 启动自动化 Harness Benchmark 评估... | 模型: ${this.opts.modelName}`);
    logger.info('==================================================');

    const results: TestResult[] = [];
    let passedCount = 0;
    let totalCost = 0;

    for (const tc of testcases) {
      logger.info(`\n>>> ⏳ 正在执行用例 [${tc.id}]: ${tc.name}`);
      const res = await this.runSingleTest(tc);
      results.push(res);
      totalCost += res.totalCostCNY;
      if (res.passed) {
        passedCount++;
        logger.info(
          `>>> ✅ 用例 [${tc.id}] 测试通过! | 耗时: ${res.durationMs}ms | 花费: ¥${res.totalCostCNY.toFixed(6)}`
        );
      } else {
        logger.error(`>>> ❌ 用例 [${tc.id}] 测试失败! | 错误: ${res.errorMsg}`);
      }
    }

    // 终极报告
    const passRate = testcases.length === 0 ? 0 : (passedCount / testcases.length) * 100;
    logger.info('\n================ 🏆 跑分终极报告 ================');
    logger.info(
      `总用例数: ${testcases.length} | 成功数: ${passedCount} | 成功率: ${passRate.toFixed(2)}%`
    );
    logger.info(`总消耗成本: ¥${totalCost.toFixed(6)}`);
    logger.info('==================================================');

    return results;
  }

  /**
   * 执行单个用例：建沙箱 → setup → 跑 Agent → validate → 出报告。
   */
  private async runSingleTest(tc: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    // 1. 为每个用例创建一个绝对干净的沙箱目录（物理隔离）
    const sandboxDir = path.join(this.opts.workspaceRoot, `${tc.id}_${Date.now()}`);
    fs.mkdirSync(sandboxDir, { recursive: true });

    // 2. （可选）执行 Setup 脚本准备靶机代码
    if (tc.setupScript) {
      try {
        execSync(tc.setupScript, { cwd: sandboxDir, stdio: 'pipe' });
      } catch (e) {
        const duration = Date.now() - startTime;
        return {
          testCaseId: tc.id,
          passed: false,
          durationMs: duration,
          totalCostCNY: 0,
          errorMsg: `靶机 Setup 失败: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    }

    // 3. 组装具备打点能力（Tracker）的引擎
    const realProvider = this.opts.providerFactory(this.opts.modelName);
    const session = new Session(tc.id, sandboxDir);
    const trackedProvider = new CostTracker(realProvider, this.opts.modelName, session);

    const registry = new RegistryImpl();
    registry.register(new ReadFileTool(sandboxDir));
    registry.register(new WriteFileTool(sandboxDir));
    registry.register(new BashTool(sandboxDir));
    registry.register(new EditFileTool(sandboxDir));

    const eng = new AgentEngine(
      trackedProvider,
      registry,
      sandboxDir,
      this.opts.enableThinking,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    // 4. 让 Agent 开始干活
    session.append({ role: Role.User, content: tc.taskPrompt });
    // 静默 reporter：跑分时屏蔽普通日志防止刷屏
    const noopReporter = {
      onThinking: () => {},
      onToolCall: () => {},
      onToolResult: () => {},
      onMessage: () => {},
    };
    try {
      await eng.run(session, tc.taskPrompt, undefined, noopReporter);
    } catch (e) {
      const duration = Date.now() - startTime;
      return {
        testCaseId: tc.id,
        passed: false,
        durationMs: duration,
        totalCostCNY: session.totalCostCNY,
        errorMsg: `Agent 崩溃: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    // 5. 【核心断言】Agent 跑完了，我们来验收成果！
    let validateOutput = '';
    let validateFailed = false;
    try {
      validateOutput = execSync(tc.validateScript, {
        cwd: sandboxDir,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
    } catch (e) {
      validateFailed = true;
      const err = e as { stdout?: unknown; stderr?: unknown };
      const stdout = err.stdout !== undefined ? String(err.stdout) : '';
      const stderr = err.stderr !== undefined ? String(err.stderr) : '';
      validateOutput = stdout + (stderr ? `\n[stderr]\n${stderr}` : '');
    }

    const duration = Date.now() - startTime;

    if (validateFailed) {
      return {
        testCaseId: tc.id,
        passed: false,
        totalCostCNY: session.totalCostCNY,
        durationMs: duration,
        errorMsg: `验证脚本执行失败: ${validateOutput.slice(0, 500)}`,
        validateOutput,
      };
    }

    return {
      testCaseId: tc.id,
      passed: true,
      totalCostCNY: session.totalCostCNY,
      durationMs: duration,
    };
  }
}