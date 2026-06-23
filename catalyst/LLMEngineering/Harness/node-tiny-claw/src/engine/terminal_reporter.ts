/* eslint-disable no-console */
/**
 * TerminalReporter 整个文件的目的就是直接 console 输出，console.* 是合规的用法。
 * 接口方法的形参名是公开 API 的一部分（实现侧会用到），按 ESLint 默认规则会被误报为 unused。
 */

/** onToolCall 中参数字符串的最大展示长度；超出部分会被截断 */
const ARGS_DISPLAY_LIMIT = 150;
/** 截断后追加的省略标记 */
const TRUNCATED_SUFFIX = '... (已截断)';

/**
 * Reporter 抽象了"把 Agent 状态反馈给用户"的渠道。
 * 不同实现可对接终端、JSON 流、web UI 等。
 *
 * 接口内方法形参的命名是公开 API 的一部分（实现侧会用到），
 * ESLint 默认 no-unused-vars 规则会把它们误报为 unused。
 */
/* eslint-disable no-unused-vars */
export interface Reporter {
  onThinking(): void;
  onToolCall(toolName: string, args: string): void;
  onToolResult(toolName: string, result: string, isError: boolean): void;
  onMessage(content: string): void;
}
/* eslint-enable no-unused-vars */

/**
 * TerminalReporter 是 Reporter 的终端直出实现：
 * - 成功路径走 console.log
 * - 失败路径走 console.error（Unix 习惯，便于 grep）
 */
export class TerminalReporter implements Reporter {
  onThinking(): void {
    console.log('\n[🤔 思考中] 模型正在推理...\n');
  }

  onToolCall(toolName: string, args: string): void {
    console.log(`[🛠️ 调用工具] ${toolName}`);

    // 先转义：换行 / 回车换成可见字面
    let displayArgs = args.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

    // 再截断：超长截到 150 字符
    if (displayArgs.length > ARGS_DISPLAY_LIMIT) {
      displayArgs = displayArgs.slice(0, ARGS_DISPLAY_LIMIT) + TRUNCATED_SUFFIX;
    }

    console.log(`   参数: ${displayArgs}`);
  }

  onToolResult(toolName: string, result: string, isError: boolean): void {
    if (isError) {
      console.error(`[❌ 执行失败] ${toolName}`);
      if (result !== '') {
        console.error(`   错误: ${result}`);
      }
      return;
    }
    console.log(`[✅ 执行成功] ${toolName}`);
  }

  onMessage(content: string): void {
    if (content === '') {
      return;
    }
    console.log(`\n🤖 Agent 回复:\n${content}\n\n`);
  }
}

/** 与 Go 的 NewTerminalReporter() 对应的工厂入口 */
export function newTerminalReporter(): TerminalReporter {
  return new TerminalReporter();
}
