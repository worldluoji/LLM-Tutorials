// recovery.ts
/**
 * Error Recovery：把工具底层报错改造成"行动指南"——在原始错误后追加
 * 系统级救援建议，引导大模型走向正确的自救路径，而不是机械道歉或盲目重试。
 *
 * 设计哲学：字符串 includes() 匹配（教程明示的脆弱性）。
 * 工业级应替换为领域错误码（ERR_FILE_NOT_FOUND 等），本模块仅演示劫持注入。
 *
 * TS 适配说明：read_file / write_file 工具在 catch 中将原生 ENOENT
 * 翻译为中文 `"Error: 文件 '...' 不存在。"`，所以 Go 版
 * "no such file or directory" 模式不会命中。
 * 这里补一条 `FILE_NOT_FOUND_CN_ADAPTED` 中文分支映射到相同的"先 ls/find"救援，
 * 让 recovery 在 TS 生态里真的能 fire；其他分支原样沿用 Go 参考。
 */
export class RecoveryManager {
  /** 工具内部手写的固定报错（edit_file fuzzyReplace / bash 超时） */
  private static readonly EDIT_NOT_FOUND_CN = '在文件中未找到 old_text';
  private static readonly EDIT_L4_NOT_FOUND_CN = '找不到该代码片段';
  private static readonly EDIT_MULTI_MATCH_CN = '匹配到了';
  private static readonly EDIT_NEED_MORE_CONTEXT_CN = '上下文';

  private static readonly BASH_TIMEOUT_CN = '超时';
  private static readonly BASH_DEADLINE_EXCEEDED = 'DeadlineExceeded';

  /** 底层系统抛出的 POSIX 标准错误（read_file / write_file 在 Go 版透传，在 TS 版被翻译） */
  private static readonly FILE_NOT_FOUND_EN = 'no such file or directory';
  private static readonly FILE_PERMISSION_DENIED_EN = 'permission denied';

  /** 进程级报错（bash 透传 exec.stderr） */
  private static readonly BASH_CMD_NOT_FOUND_EN = 'command not found';
  private static readonly BASH_SYNTAX_ERROR_EN = 'syntax error';

  /** TS 适配：read_file / write_file 在 catch 里翻译出的中文版文件不存在 */
  private static readonly FILE_NOT_FOUND_CN_ADAPTED = "文件 '"; // 配合结尾的 "不存在。" 判断

  /**
   * AnalyzeAndInject 接收工具名与原始报错，返回增强后的报错字符串：
   * - 若命中特征模式，追加"\n\n[系统救援指南]: <hint>"
   * - 若未命中，原样返回 rawError
   */
  analyzeAndInject(toolName: string, rawError: string): string {
    const hint = this.matchHint(toolName, rawError);
    if (hint === '') {
      return rawError;
    }
    return `${rawError}\n\n[系统救援指南]: ${hint}`;
  }

  private matchHint(toolName: string, rawError: string): string {
    const lower = rawError.toLowerCase();

    switch (toolName) {
      case 'edit_file':
        if (
          rawError.includes(RecoveryManager.EDIT_NOT_FOUND_CN) ||
          rawError.includes(RecoveryManager.EDIT_L4_NOT_FOUND_CN)
        ) {
          return '你提供的 old_text 与文件当前内容不一致，或者缺少必要的缩进。请先使用 `read_file` 工具重新读取该文件，获取最新、准确的内容后，再重新发起编辑。';
        }
        if (
          rawError.includes(RecoveryManager.EDIT_MULTI_MATCH_CN) ||
          rawError.includes(RecoveryManager.EDIT_NEED_MORE_CONTEXT_CN)
        ) {
          return '你的 old_text 不够具体，命中了多个相同代码块。请在 old_text 中增加上下相邻的几行代码，以确保替换的唯一性。';
        }
        return '';

      case 'read_file':
      case 'write_file':
        // Go 原生匹配：底层透传 POSIX 报错时能命中（万一以后工具改为透传）
        if (lower.includes(RecoveryManager.FILE_NOT_FOUND_EN)) {
          return '路径似乎不正确。请不要凭空猜测，先使用 `bash` 执行 `ls -la` 或 `find . -name` 命令查找正确的目录结构和文件名。';
        }
        if (lower.includes(RecoveryManager.FILE_PERMISSION_DENIED_EN)) {
          return '你没有权限操作该文件。请检查工作区限制，或者思考是否需要修改其他文件。';
        }
        // TS 适配分支：当前 read_file / write_file 在 catch 中将 ENOENT 翻译为
        // "Error: 文件 '<path>' 不存在。" —— 关键特征是 "文件 '" + 路径 + "' 不存在"
        if (
          rawError.includes(RecoveryManager.FILE_NOT_FOUND_CN_ADAPTED) &&
          rawError.includes('不存在')
        ) {
          return '路径似乎不正确。请不要凭空猜测，先使用 `bash` 执行 `ls -la` 或 `find . -name` 命令查找正确的目录结构和文件名。';
        }
        return '';

      case 'bash':
        if (lower.includes(RecoveryManager.BASH_CMD_NOT_FOUND_EN)) {
          return '系统中未安装该命令。请先思考：是否有替代命令？或者你需要先编写脚本进行安装？';
        }
        if (
          rawError.includes(RecoveryManager.BASH_TIMEOUT_CN) ||
          rawError.includes(RecoveryManager.BASH_DEADLINE_EXCEEDED)
        ) {
          return '该命令执行被超时强杀。如果它是一个常驻服务（如 server 或 watch），请将其转入后台执行（例如使用 `nohup ... &`），不要阻塞主线程。';
        }
        if (lower.includes(RecoveryManager.BASH_SYNTAX_ERROR_EN)) {
          return 'Bash 语法错误。请检查引号转义或特殊字符，确保命令在终端中可直接运行。';
        }
        return '';

      default:
        return '';
    }
  }
}