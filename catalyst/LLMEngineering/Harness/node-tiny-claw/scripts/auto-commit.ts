#!/usr/bin/env pnpm tsx
/**
 * auto-commit.ts
 *
 * 自动提交代码的脚本，遵循 Conventional Commits 规范
 *
 * 用法：
 *   pnpm auto-commit "feat: 添加新功能"     # 直接提交
 *   pnpm auto-commit --all "fix: 修复bug"   # 暂存所有更改并提交
 *
 * 环境变量：
 *   GIT_COMMIT_TYPE - 提交类型 (feat, fix, docs, etc.)
 *   GIT_COMMIT_SCOPE - 提交范围 (可选)
 *   GIT_COMMIT_MSG - 提交描述
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Conventional Commits 类型映射
const COMMIT_TYPES: Record<string, string> = {
  feat: '新功能',
  fix: 'Bug 修复',
  docs: '文档更新',
  style: '代码格式（不影响功能）',
  refactor: '重构（不影响功能）',
  test: '测试相关',
  chore: '构建/工具相关',
};

/**
 * 执行命令
 */
function exec(command: string, showOutput = false): string {
  try {
    if (showOutput) {
      execSync(command, { cwd: ROOT_DIR, stdio: 'inherit' });
      return '';
    }
    return execSync(command, { cwd: ROOT_DIR, encoding: 'utf-8', stdio: 'pipe' }).toString().trim();
  } catch (error) {
    if (showOutput && error instanceof Error) {
      console.error(`命令执行失败: ${error.message}`);
    }
    return '';
  }
}

/**
 * 获取 git 状态
 */
function getGitStatus(): string {
  return exec('git status --porcelain');
}

/**
 * 获取变更文件列表
 */
function getChangedFiles(): string[] {
  const status = getGitStatus();
  return status
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.slice(3).trim());
}

/**
 * 获取当前分支名
 */
function getBranchName(): string {
  return exec('git branch --show-current');
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
🛠️  Auto Commit - 自动提交工具

用法:
  pnpm auto-commit <message>           # 提交当前暂存的文件
  pnpm auto-commit --all <message>     # 自动暂存所有更改并提交
  pnpm auto-commit --help              # 显示帮助信息

示例:
  pnpm auto-commit "feat: 添加用户登录功能"
  pnpm auto-commit "fix: 修复登录页面样式问题"
  pnpm auto-commit --all "docs: 更新 README"

 Conventional Commits 类型:
${Object.entries(COMMIT_TYPES)
  .map(([type, desc]) => `  ${type.padEnd(12)} - ${desc}`)
  .join('\n')}
`);
}

/**
 * 验证提交信息格式
 */
function validateCommitMessage(msg: string): boolean {
  if (!msg || msg.length < 3) {
    return false;
  }
  // 检查是否符合 Conventional Commits 格式
  const pattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/;
  return pattern.test(msg);
}

/**
 * 主逻辑
 */
function main() {
  const args = process.argv.slice(2);

  // 显示帮助
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const isAll = args.includes('--all');

  // 获取提交信息
  let commitMsg = '';

  if (isAll) {
    commitMsg = args.filter((a) => a !== '--all').join(' ');
  } else {
    commitMsg = args.join(' ');
  }

  // 如果没有提交信息，从环境变量读取
  if (!commitMsg && process.env.GIT_COMMIT_MSG) {
    commitMsg = process.env.GIT_COMMIT_MSG;
  }

  // 如果有环境变量构建提交信息
  if (!commitMsg && process.env.GIT_COMMIT_TYPE) {
    const type = process.env.GIT_COMMIT_TYPE;
    const scope = process.env.GIT_COMMIT_SCOPE || '';
    const desc = process.env.GIT_COMMIT_DESC || '';
    commitMsg = scope ? `${type}(${scope}): ${desc}` : `${type}: ${desc}`;
  }

  if (!commitMsg) {
    console.error('❌ 请提供提交信息');
    console.log('   示例: pnpm auto-commit "feat: 添加新功能"');
    console.log('   或设置 GIT_COMMIT_MSG 环境变量');
    showHelp();
    process.exit(1);
  }

  // 验证格式
  if (!validateCommitMessage(commitMsg)) {
    console.warn('⚠️  警告: 提交信息不符合 Conventional Commits 格式');
    console.log(`   格式: type(scope): description`);
    console.log(`   示例: feat: 添加用户登录功能`);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('🛠️  Auto Commit');
  console.log('='.repeat(60));

  // 检查 git 状态
  getGitStatus();
  const files = getChangedFiles();

  if (files.length === 0 && !isAll) {
    console.log('⚠️  没有暂存的文件');
    console.log('   使用 --all 自动暂存所有更改');
    return;
  }

  console.log(`\n📋 当前分支: ${getBranchName()}`);
  console.log(`📁 变更文件: ${files.length} 个`);

  if (files.length > 0) {
    console.log('\n变更文件:');
    files.slice(0, 10).forEach((f) => console.log(`  - ${f}`));
    if (files.length > 10) {
      console.log(`  ... 还有 ${files.length - 10} 个文件`);
    }
  }

  console.log(`\n📝 提交信息: ${commitMsg}`);

  // 执行提交
  console.log('\n🚀 正在提交...');

  try {
    if (isAll) {
      exec('git add -A');
      console.log('   已暂存所有更改');
    } else {
      exec(`git add ${files.join(' ')}`);
    }

    exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);

    console.log('\n✅ 提交成功!');
    console.log(`   分支: ${getBranchName()}`);

    // 显示最近提交
    const lastCommit = exec('git log -1 --oneline');
    if (lastCommit) {
      console.log(`   提交: ${lastCommit}`);
    }
  } catch (error) {
    console.error('\n❌ 提交失败');
    console.error(`   ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main();