/**
 * test.recovery.ts
 *
 * 表格驱动测试：验证 RecoveryManager 在工具报错改写上的行为。
 * 对应教程：13. Error Recovery.md
 *
 * 运行：pnpm test --recovery
 */
import assert from 'node:assert/strict';
import { RecoveryManager } from '../../src/context/recovery.ts';

// ============================================================
// 表格：每个用例是一条独立的"工具名 + 原始错误 -> 期望增强文本"
// ============================================================
interface RecoveryCase {
  name: string;
  toolName: string;
  rawError: string;
  /** 期望增强后的内容包含此字符串 */
  expectContains?: string;
  /** 期望增强后的内容等于原字符串（即未命中模式，原样返回） */
  expectUntouched?: boolean;
  /** 期望增强后的内容必须保留原始报错（避免破坏上下文追溯） */
  expectRawPreserved?: boolean;
}

const recoveryCases: RecoveryCase[] = [
  // ============================================================
  // edit_file 分支
  // ============================================================
  {
    name: '#E1 edit_file L1/L2/L3 未命中 - 匹配"在文件中未找到 old_text"',
    toolName: 'edit_file',
    rawError: 'Error: 在文件中未找到 old_text，请大模型先调用 read_file 仔细确认文件内容和缩进',
    expectContains: '请先使用 `read_file`',
    expectRawPreserved: true,
  },
  {
    name: '#E2 edit_file L4 兜底未命中 - 匹配"找不到该代码片段"',
    toolName: 'edit_file',
    rawError: 'Error: 找不到该代码片段',
    expectContains: '请先使用 `read_file`',
    expectRawPreserved: true,
  },
  {
    name: '#E3 edit_file L1 多处匹配 - 匹配"匹配到了"',
    toolName: 'edit_file',
    rawError: 'Error: old_text 匹配到了 3 处，请提供更多的上下文代码以确保唯一性',
    expectContains: '在 old_text 中增加上下相邻的几行代码',
    expectRawPreserved: true,
  },
  {
    name: '#E4 edit_file L4 模糊多处 - 匹配"匹配到了"+"上下文"',
    toolName: 'edit_file',
    rawError: 'Error: 模糊匹配到了 2 处相似代码，请提供更多上下行代码以精确定位',
    expectContains: '在 old_text 中增加上下相邻的几行代码',
    expectRawPreserved: true,
  },
  {
    name: '#E5 edit_file 无关错误 - 原样返回',
    toolName: 'edit_file',
    rawError: 'Error: 路径 \'../../etc/passwd\' 超出工作区范围。',
    expectUntouched: true,
  },

  // ============================================================
  // read_file / write_file 分支
  // ============================================================
  {
    name: '#F1 read_file POSIX 透传 - 匹配"no such file"',
    toolName: 'read_file',
    rawError: 'Error: ENOENT: no such file or directory, open \'missing.txt\'',
    expectContains: '先使用 `bash` 执行 `ls -la`',
    expectRawPreserved: true,
  },
  {
    name: '#F2 read_file POSIX 透传 - 匹配"permission denied"',
    toolName: 'read_file',
    rawError: 'Error: EACCES: permission denied, open \'/root/secret\'',
    expectContains: '你没有权限操作该文件',
    expectRawPreserved: true,
  },
  {
    name: '#F3 read_file TS 中文版（实际生产格式） - 匹配"文件 \'...\' 不存在"',
    toolName: 'read_file',
    rawError: "Error: 文件 'src/missing.ts' 不存在。",
    expectContains: '先使用 `bash` 执行 `ls -la`',
    expectRawPreserved: true,
  },
  {
    name: '#F4 write_file TS 中文版 - 命中同样的 TS 适配分支',
    toolName: 'write_file',
    rawError: "Error: 文件 'foo.txt' 不存在。",
    expectContains: '先使用 `bash` 执行 `ls -la`',
    expectRawPreserved: true,
  },
  {
    name: '#F5 write_file 路径穿越 - 原样返回（未匹配任何模式）',
    toolName: 'write_file',
    rawError: "Error: 路径 '../escape.txt' 超出工作区范围。",
    expectUntouched: true,
  },
  {
    name: '#F6 write_file 创建父目录失败含 permission denied - 命中权限救援',
    toolName: 'write_file',
    rawError: 'Error: 创建父目录失败: EACCES: permission denied',
    expectContains: '你没有权限操作该文件',
    expectRawPreserved: true,
  },

  // ============================================================
  // bash 分支
  // ============================================================
  {
    name: '#B1 bash command not found - 匹配 exec.stderr 透传',
    toolName: 'bash',
    rawError: '执行报错: /bin/bash: foobar: command not found',
    expectContains: '系统中未安装该命令',
    expectRawPreserved: true,
  },
  {
    name: '#B2 bash 超时 - 匹配中文警告中的"超时"',
    toolName: 'bash',
    rawError: '[警告: 命令执行超时(30s)，已被系统强制终止。如果是启动常驻服务，请尝试将其转入后台。]',
    expectContains: '转入后台执行（例如使用 `nohup ... &`）',
    expectRawPreserved: true,
  },
  {
    name: '#B3 bash 超时 - 匹配 Go 风格的 DeadlineExceeded',
    toolName: 'bash',
    rawError: 'context.DeadlineExceeded: operation took too long',
    expectContains: '转入后台执行',
    expectRawPreserved: true,
  },
  {
    name: '#B4 bash syntax error - 匹配 exec.stderr 透传',
    toolName: 'bash',
    rawError: '执行报错: bash: -c: line 1: syntax error near unexpected token',
    expectContains: 'Bash 语法错误',
    expectRawPreserved: true,
  },
  {
    name: '#B5 bash 退出码非零但无关键字 - 原样返回',
    toolName: 'bash',
    rawError: '执行报错: ls: cannot access \'nope\': No such file or directory',
    expectUntouched: true,
  },

  // ============================================================
  // 通用兜底
  // ============================================================
  {
    name: '#U1 未知工具名 - 原样返回',
    toolName: 'unknown_tool',
    rawError: 'something went wrong',
    expectUntouched: true,
  },
  {
    name: '#U2 空字符串 - 原样返回（不应注入空救援指南）',
    toolName: 'edit_file',
    rawError: '',
    expectUntouched: true,
  },
];

// ============================================================
// 运行器
// ============================================================
function runCases(): number {
  let failed = 0;
  console.log('--- RecoveryManager.analyzeAndInject ---');

  const rm = new RecoveryManager();

  for (const c of recoveryCases) {
    try {
      const result = rm.analyzeAndInject(c.toolName, c.rawError);

      if (c.expectUntouched) {
        assert.equal(
          result,
          c.rawError,
          `${c.name}: 未命中模式时应当原样返回\n  rawError: ${JSON.stringify(c.rawError)}\n  result:   ${JSON.stringify(result)}`
        );
      } else {
        if (c.expectContains) {
          assert.ok(
            result.includes(c.expectContains),
            `${c.name}: 期望增强结果包含 '${c.expectContains}'\n  rawError: ${JSON.stringify(c.rawError)}\n  result:   ${JSON.stringify(result)}`
          );
        }
        if (c.expectRawPreserved) {
          assert.ok(
            result.startsWith(c.rawError),
            `${c.name}: 原始报错必须保留在前缀位置（不能丢失上下文追溯）\n  rawError: ${JSON.stringify(c.rawError)}\n  result:   ${JSON.stringify(result)}`
          );
          assert.ok(
            result.includes('[系统救援指南]:'),
            `${c.name}: 增强结果必须带 [系统救援指南] 标记\n  result: ${JSON.stringify(result)}`
          );
        }
      }

      console.log(`✅ ${c.name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${c.name}\n   ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return failed;
}

function main(): void {
  const failed = runCases();
  const total = recoveryCases.length;
  console.log(`\n=== ${total - failed}/${total} 用例通过 ===`);
  if (failed > 0) process.exit(1);
}

main();