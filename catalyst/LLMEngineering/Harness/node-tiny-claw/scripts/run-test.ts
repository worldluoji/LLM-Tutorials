/**
 * scripts/run-test.ts
 *
 * 统一测试运行脚本，自动加载 .env 环境变量
 *
 * 用法：
 *   pnpm test                  # 运行所有测试
 *   pnpm test --minimax        # 运行 minimax provider 测试
 *   pnpm test --read-file      # 运行 read-file 工具单元测试
 *   pnpm test --read-file-tool # 运行 read-file 集成测试
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 解析命令行参数
const args = process.argv.slice(2);

// 定义测试配置
interface TestConfig {
  name: string;
  command: string;
  description: string;
  requireEnv?: string[];
}

const testConfigs: TestConfig[] = [
  {
    name: 'minimax',
    command: 'tsx test/llm/test.minimax-provider.ts',
    description: 'MiniMax Provider 测试',
    requireEnv: ['MINIMAX_API_KEY'],
  },
  {
    name: 'read-file',
    command: 'tsx test/tools/test.read-file.ts',
    description: 'ReadFileTool 单元测试',
  },
  {
    name: 'read-file-tool',
    command: 'tsx test/tools/test.read-file-tool.ts',
    description: 'ReadFileTool 集成测试（需要 MiniMax）',
    requireEnv: ['MINIMAX_API_KEY'],
  },
  {
    name: 'bash',
    command: 'tsx test/tools/test.bash.ts',
    description: 'BashTool 单元测试',
  },
  {
    name: 'write-file',
    command: 'tsx test/tools/test.write-file.ts',
    description: 'WriteFileTool 单元测试',
  },
  {
    name: 'edit-file',
    command: 'tsx test/tools/test.edit-file.ts',
    description: 'EditFileTool 单元测试',
  },
  {
    name: 'parallel-dispatch',
    command: 'tsx test/engine/test.parallel-dispatch.engine.ts',
    description: 'AgentEngine 并行工具分发表格驱动测试',
  },
  {
    name: 'skill',
    command: 'tsx test/context/test.skill.ts',
    description: 'SkillLoader 单元测试',
  },
  {
    name: 'composer',
    command: 'tsx test/context/test.composer.ts',
    description: 'PromptComposer 单元测试',
  },
  {
    name: 'composer-integration',
    command: 'tsx test/engine/test.composer-integration.engine.ts',
    description: 'PromptComposer 集成到 Main Loop 的端到端测试',
  },
  {
    name: 'terminal-reporter',
    command: 'tsx test/engine/test.terminal-reporter.engine.ts',
    description: 'TerminalReporter 单元测试',
  },
  {
    name: 'parse-text-tool-calls',
    command: 'tsx test/llm/test.parse-text-tool-calls.ts',
    description: 'parseTextToolCalls 纯函数单元测试',
  },
];

// 检查环境变量
function checkEnvVars(config: TestConfig): boolean {
  if (!config.requireEnv) return true;

  const missing = config.requireEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`⚠️  跳过 ${config.name}: 缺少环境变量 ${missing.join(', ')}`);
    return false;
  }
  return true;
}

// 运行测试
function runTest(config: TestConfig): number {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 运行: ${config.description}`);
  console.log(`${'='.repeat(60)}`);

  try {
    execSync(config.command, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
    console.log(`✅ ${config.name} 通过`);
    return 0;
  } catch {
    console.error(`❌ ${config.name} 失败`);
    return 1;
  }
}

// 主逻辑
function main() {
  // 如果没有参数，运行所有测试
  if (args.length === 0 || args[0] === 'all') {
    console.log('🚀 运行所有测试...');

    let failed = 0;
    for (const config of testConfigs) {
      if (checkEnvVars(config)) {
        failed += runTest(config);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    if (failed === 0) {
      console.log('✅ 所有测试通过');
    } else {
      console.log(`❌ ${failed} 个测试失败`);
      process.exit(1);
    }
    return;
  }

  // 解析参数
  const testName = args[0].replace(/^--/, '');
  const config = testConfigs.find((c) => c.name === testName);

  if (!config) {
    console.error(`❌ 未知测试: ${testName}`);
    console.log(`可用测试: ${testConfigs.map((c) => c.name).join(', ')}`);
    process.exit(1);
  }

  if (!checkEnvVars(config)) {
    process.exit(1);
  }

  runTest(config);
}

main();
