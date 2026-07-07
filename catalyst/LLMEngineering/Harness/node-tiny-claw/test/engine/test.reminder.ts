/**
 * test.reminder.ts
 *
 * 表格驱动测试：验证 ReminderInjector 的指纹聚合 + 死循环干预触发逻辑。
 * 对应教程：14. Doom Loop.md
 *
 * 运行：pnpm test --reminder
 */
import assert from 'node:assert/strict';
import { ReminderInjector } from '../../src/engine/reminder.ts';
import { Role } from '../../src/schema/message.ts';

// ============================================================
// 表格：每个用例是一条独立的"前置状态 + 一次调用 → 期望返回值 / 计数器"
// ============================================================
interface ReminderCase {
  name: string;
  /** 调用前预先执行多少次失败（针对主调用自身的 toolName/args） */
  primeFailures?: number;
  /**
   * 调用前预先执行若干"其他指纹"的失败，用于验证多指纹并存场景。
   * 每个 prime 在独立的 (toolName, args) 上累加 count 次失败。
   */
  primes?: Array<{ toolName: string; args: unknown; count: number }>;
  toolName: string;
  args: unknown;
  isError: boolean;
  /** 期望返回 Message（注入）或 null（不注入） */
  expectInjected: boolean;
  /** 期望返回的 Message 包含特定子串 */
  expectContains?: string[];
  /** 期望返回的 Message.role 必须是 RoleUser（教程的硬约束） */
  expectRoleUser?: boolean;
  /** 期望调用后该指纹的失败计数快照 */
  expectCount?: number;
  /** 期望某 otherFp 的计数（用于验证"成功清空所有计数"语义） */
  expectOtherCount?: { name: string; args: unknown; expected: number };
  expectOtherAbsent?: { name: string; args: unknown };
}

const tc = (name: string, args: unknown) => ({ name, arguments: args });

const reminderCases: ReminderCase[] = [
  // ============================================================
  // 基础累加 + 阈值触发
  // ============================================================
  {
    name: '#1 第 1 次失败 - 不注入，计数 = 1',
    toolName: 'bash',
    args: { command: 'ls' },
    isError: true,
    expectInjected: false,
    expectCount: 1,
  },
  {
    name: '#2 第 2 次失败（相同指纹）- 不注入，计数 = 2',
    primeFailures: 1,
    toolName: 'bash',
    args: { command: 'ls' },
    isError: true,
    expectInjected: false,
    expectCount: 2,
  },
  {
    name: '#3 第 3 次失败（相同指纹）- 触发注入！计数 = 3',
    primeFailures: 2,
    toolName: 'bash',
    args: { command: 'ls' },
    isError: true,
    expectInjected: true,
    expectRoleUser: true,
    expectContains: [
      '[SYSTEM REMINDER 警告]',
      '死循环',
      "'bash'",
      '3 次',
      '停止猜测参数',
      '跳出当前的局部思维',
      '彻底改变你的策略',
    ],
    expectCount: 3,
  },
  {
    name: '#4 第 4 次失败（相同指纹）- 仍注入，计数 = 4',
    primeFailures: 3,
    toolName: 'bash',
    args: { command: 'ls' },
    isError: true,
    expectInjected: true,
    expectRoleUser: true,
    expectContains: ['[SYSTEM REMINDER 警告]', '4 次'],
    expectCount: 4,
  },

  // ============================================================
  // 不同指纹独立计数
  // ============================================================
  {
    name: '#5 不同参数指纹 - 独立计数，不触发（即使 bash 总失败 3 次）',
    toolName: 'bash',
    args: { command: 'pwd' }, // 与上面 ls 不同指纹
    isError: true,
    expectInjected: false,
    expectCount: 1,
  },
  {
    name: '#6 不同工具名同参数 - 独立计数（预热 bash=3 后调用 edit_file）',
    primes: [{ toolName: 'bash', args: { command: 'ls' }, count: 3 }],
    toolName: 'edit_file',
    args: { path: 'a.txt', old_text: 'x', new_text: 'y' },
    isError: true,
    expectInjected: false,
    expectCount: 1,
    // 预热的 bash ls 计数（3）应被保留——证明新失败未污染旧指纹
    expectOtherCount: { name: 'bash', args: { command: 'ls' }, expected: 3 },
  },
  {
    name: '#7 不同工具名 + 同样达到阈值 - 独立触发',
    primeFailures: 2,
    toolName: 'read_file',
    args: { path: 'missing.ts' },
    isError: true,
    expectInjected: true,
    expectRoleUser: true,
    expectContains: ["'read_file'", '3 次'],
  },

  // ============================================================
  // 成功清空所有计数（关键正确性）
  // ============================================================
  {
    name: '#8 任意成功调用 - 清空所有失败计数器（包括其他指纹）',
    primeFailures: 3,
    toolName: 'bash',
    args: { command: 'ls' }, // 这次成功了
    isError: false,
    expectInjected: false,
    // 之前 #3 累积的 bash ls 计数（3）应被清空
    expectOtherAbsent: { name: 'bash', args: { command: 'ls' } },
  },
  {
    name: '#9 清空后再次失败 - 从 1 重新计数，不会"继承"旧执念',
    toolName: 'bash',
    args: { command: 'ls' },
    isError: true,
    expectInjected: false,
    expectCount: 1,
  },

  // ============================================================
  // 边界：相同语义的 string vs object 参数应能稳定产生指纹
  // ============================================================
  {
    name: '#10 string args 与 object args 是不同指纹（按 Go 版的 []byte 语义）',
    primeFailures: 2,
    toolName: 'bash',
    args: '{"command":"ls"}', // string 形式
    isError: true,
    expectInjected: true,
    expectContains: ['3 次'],
  },
];

// ============================================================
// 运行器
// ============================================================
function runCases(): number {
  let failed = 0;
  console.log('--- ReminderInjector.checkAndInject ---');

  for (const c of reminderCases) {
    try {
      const ri = new ReminderInjector();

      // 预热：模拟"已经失败过 primeFailures 次"（主指纹）
      if (c.primeFailures && c.primeFailures > 0) {
        for (let i = 0; i < c.primeFailures; i++) {
          ri.checkAndInject(tc(c.toolName, c.args), {
            tool_call_id: 'warmup',
            output: 'warmup',
            is_error: true,
          });
        }
      }
      // 预热：模拟其他指纹的失败历史（多指纹并存场景）
      if (c.primes) {
        for (const p of c.primes) {
          for (let i = 0; i < p.count; i++) {
            ri.checkAndInject(tc(p.toolName, p.args), {
              tool_call_id: 'warmup-other',
              output: 'warmup-other',
              is_error: true,
            });
          }
        }
      }

      // 主调用
      const result = ri.checkAndInject(tc(c.toolName, c.args), {
        tool_call_id: 'main',
        output: 'some output',
        is_error: c.isError,
      });

      if (c.expectInjected) {
        assert.ok(result !== null, `${c.name}: 期望注入但返回了 null`);
        assert.equal(result!.role, Role.User, `${c.name}: 注入消息必须是 Role.User（教程硬约束：近因权重）`);
        for (const expected of c.expectContains ?? []) {
          assert.ok(
            result!.content.includes(expected),
            `${c.name}: 注入消息应包含 '${expected}'\n  实际: ${JSON.stringify(result!.content)}`
          );
        }
      } else {
        assert.equal(result, null, `${c.name}: 不应注入但返回了非 null`);
      }

      // 验证自身指纹计数
      if (c.expectCount !== undefined) {
        const actual = ri.getFailureCount(c.toolName, c.args);
        assert.equal(
          actual,
          c.expectCount,
          `${c.name}: 期望指纹计数 ${c.expectCount}，实际 ${actual}`
        );
      }

      // 验证其他指纹计数（用于"成功清空所有"语义）
      if (c.expectOtherCount) {
        const actual = ri.getFailureCount(c.expectOtherCount.name, c.expectOtherCount.args);
        assert.equal(
          actual,
          c.expectOtherCount.expected,
          `${c.name}: 期望 other 指纹计数 ${c.expectOtherCount.expected}，实际 ${actual}`
        );
      }
      if (c.expectOtherAbsent) {
        const actual = ri.getFailureCount(c.expectOtherAbsent.name, c.expectOtherAbsent.args);
        assert.equal(actual, 0, `${c.name}: 期望 other 指纹已被清空，实际 ${actual}`);
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
  const total = reminderCases.length;
  console.log(`\n=== ${total - failed}/${total} 用例通过 ===`);
  if (failed > 0) process.exit(1);
}

main();