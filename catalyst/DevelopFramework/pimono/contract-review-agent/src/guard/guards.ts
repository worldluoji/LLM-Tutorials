import type {
  ExtensionContext,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import { streamSimple } from "@earendil-works/pi-ai/compat";
import path from "node:path";

type ToolResultEventResult = {
  content?: ToolResultEvent["content"];
  details?: unknown;
  isError?: boolean;
  usage?: unknown;
};

// ---------------------------------------------------------------------------
// 类型：统一的护栏规则
// ---------------------------------------------------------------------------
export type GuardResult =
  | { action: "pass" }
  | { action: "block"; reason: string };

export type GuardRule = (
  event: ToolCallEvent,
  ctx: ExtensionContext
) => GuardResult | Promise<GuardResult>;

// ---------------------------------------------------------------------------
// 敏感信息检测：正则初筛
// ---------------------------------------------------------------------------
const SENSITIVE_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "身份证号", regex: /\d{6}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g },
  { name: "手机号", regex: /1[3-9]\d{9}/g },
  { name: "银行卡号", regex: /\d{16,19}/g },
  { name: "邮箱", regex: /[\w.-]+@[\w.-]+\.\w+/g },
];

function detectByRegex(text: string): string[] {
  const hits: string[] = [];
  for (const { name, regex } of SENSITIVE_PATTERNS) {
    regex.lastIndex = 0;
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      hits.push(`${name}: ${matches.length} 处`);
    }
  }
  return hits;
}

function redactText(text: string): { redacted: string; hits: string[] } {
  const hits: string[] = [];
  let redacted = text;
  for (const { name, regex } of SENSITIVE_PATTERNS) {
    regex.lastIndex = 0;
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      hits.push(`${name}: ${matches.length} 处`);
      redacted = redacted.replace(regex, `[REDACTED:${name}]`);
    }
  }
  return { redacted, hits };
}

// ---------------------------------------------------------------------------
// 敏感信息检测：LLM 语义确认（仅在正则命中后触发，控制成本）
// ---------------------------------------------------------------------------
async function detectByLLM(
  text: string,
  model: unknown,
  signal: AbortSignal | undefined
): Promise<string[]> {
  if (!model) return [];

  const prompt =
    `分析以下文本是否包含敏感信息（身份证、银行账号、商业机密、内部定价、对方公司名等）。` +
    `只返回敏感信息列表，每行一个，格式：类型: 内容摘要。如果没有，返回"无"。\n\n文本：\n${text}`;

  const timeoutSignal = AbortSignal.any?.([
    signal ?? new AbortController().signal,
    AbortSignal.timeout(8_000),
  ]) ?? undefined;

  try {
    const response = streamSimple(model as any, {
      systemPrompt: "你是一个敏感信息检测助手。",
      messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
    });

    const result = await response.result();
    if (result.stopReason === "error" || result.stopReason === "aborted") {
      return [];
    }
    const text2 = result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
    return text2.trim() === "无"
      ? []
      : text2.split("\n").map((s: string) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 规则 1：危险命令检测
// ---------------------------------------------------------------------------
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/,
  /curl.*\|.*sh/,
  /sudo/,
  />\s*\/dev\/null.*&/,
];

function dangerousCommandGuard(event: ToolCallEvent): GuardResult {
  if (event.toolName !== "bash") return { action: "pass" };

  const cmd = (event.input as { command?: string }).command ?? "";
  if (DANGEROUS_PATTERNS.some((p) => p.test(cmd))) {
    return { action: "block", reason: "检测到危险命令" };
  }
  return { action: "pass" };
}

// ---------------------------------------------------------------------------
// 规则 2：Web Fetch 白名单
// ---------------------------------------------------------------------------
const WEB_FETCH_WHITELIST = [
  "gov.cn",
  "court.gov.cn",
  "gsxt.gov.cn",
  "tianyancha.com",
  "qcc.com",
];

function webFetchWhitelistGuard(event: ToolCallEvent): GuardResult {
  if (event.toolName !== "web_fetch" && event.toolName !== "web_search") {
    return { action: "pass" };
  }

  const url = (event.input as { url?: string }).url ?? "";
  try {
    const hostname = new URL(url).hostname;
    const allowed = WEB_FETCH_WHITELIST.some((domain) => hostname.endsWith(domain));
    if (!allowed) {
      return { action: "block", reason: `域名 ${hostname} 不在白名单` };
    }
  } catch {
    return { action: "block", reason: "URL 格式无效" };
  }
  return { action: "pass" };
}

// ---------------------------------------------------------------------------
// 规则 3：敏感信息检测（正则 + LLM 双重）
// ---------------------------------------------------------------------------
async function sensitiveContentGuard(
  event: ToolCallEvent,
  ctx: ExtensionContext
): Promise<GuardResult> {
  const inputText = JSON.stringify(event.input);

  const regexHits = detectByRegex(inputText);
  if (regexHits.length === 0) return { action: "pass" };

  const llmHits = await detectByLLM(inputText, ctx.model, ctx.signal);

  if (llmHits.length > 0) {
    return {
      action: "block",
      reason: `检测到敏感信息: ${[...regexHits, ...llmHits].join("; ")}`,
    };
  }

  ctx.ui?.notify(`正则命中但 LLM 判断不敏感: ${regexHits.join("; ")}`, "warning");
  console.warn(`[safety] 正则命中但 LLM 放行: ${regexHits.join("; ")}`);
  return { action: "pass" };
}

// ---------------------------------------------------------------------------
// 规则 4：文件访问限制
// ---------------------------------------------------------------------------
const FORBIDDEN_PATHS = [".ssh", ".env", ".aws/credentials", ".git/config"];

function fileAccessGuard(event: ToolCallEvent, ctx: ExtensionContext): GuardResult {
  if (event.toolName !== "read" && event.toolName !== "write" && event.toolName !== "edit") {
    return { action: "pass" };
  }

  const raw = (event.input as { path?: string; filePath?: string }).path
    ?? (event.input as { filePath?: string }).filePath
    ?? "";

  const cwd = ctx.cwd;
  const absolute = path.resolve(cwd, raw);

  if (FORBIDDEN_PATHS.some((p) => absolute.includes(p))) {
    return { action: "block", reason: "禁止访问敏感文件" };
  }
  if (!absolute.startsWith(cwd)) {
    return { action: "block", reason: "禁止访问项目目录外的文件" };
  }
  return { action: "pass" };
}

// ---------------------------------------------------------------------------
// 规则 5：成本限制
// ---------------------------------------------------------------------------
const TOKEN_BUDGET = 1_000_000;

function costLimitGuard(_event: ToolCallEvent, ctx: ExtensionContext): GuardResult {
  const usage = ctx.getContextUsage();
  if (usage && typeof usage.tokens === "number" && usage.tokens > TOKEN_BUDGET) {
    return { action: "block", reason: `已超过 Token 预算 (${usage.tokens} > ${TOKEN_BUDGET})` };
  }
  return { action: "pass" };
}

// ---------------------------------------------------------------------------
// 护栏管道 + 审计日志
// ---------------------------------------------------------------------------
const guards: GuardRule[] = [
  dangerousCommandGuard,
  webFetchWhitelistGuard,
  sensitiveContentGuard,
  fileAccessGuard,
  costLimitGuard,
];

export async function runSecurityGuards(
  event: ToolCallEvent,
  ctx: ExtensionContext
): Promise<ToolCallEventResult | undefined> {
  for (const guard of guards) {
    try {
      const result = await guard(event, ctx);
      if (result.action === "block") {
        return { block: true, reason: result.reason };
      }
    } catch (err) {
      console.error(`[safety] guard ${guard.name} 执行异常:`, err);
    }
  }
  return undefined;
}

export async function logToolCall(event: ToolCallEvent): Promise<void> {
  console.log(
    `[tool_call] ${event.toolName} ${JSON.stringify(event.input).slice(0, 200)}`
  );
}

export async function logToolCallResult(event: ToolResultEvent): Promise<void> {
  const snippet = event.content
    .map((c) => (c.type === "text" ? c.text : "[image]"))
    .join("")
    .slice(0, 200);
  console.log(`[tool_result] ${event.isError ? "error" : "ok"}: ${snippet}`);
}

// ---------------------------------------------------------------------------
// 工具结果脱敏：在 tool_result 阶段检查 content 中的敏感信息，
// 把 PII 替换为 [REDACTED:类型] 后再让 LLM 看到，
// 防止敏感数据通过文件读取外泄到模型上下文。
// ---------------------------------------------------------------------------
export async function redactToolResult(
  event: ToolResultEvent,
  _toolCtx: ExtensionContext
): Promise<ToolResultEventResult | undefined> {
  if (event.isError) return undefined;
  if (!event.content || event.content.length === 0) return undefined;

  const totalHits: string[] = [];
  const newContent = event.content.map((c) => {
    if (c.type !== "text") return c;
    const { redacted, hits } = redactText(c.text);
    if (hits.length > 0) totalHits.push(...hits);
    return { ...c, text: redacted };
  });

  if (totalHits.length === 0) return undefined;

  console.warn(
    `[safety] tool_result 已脱敏: ${totalHits.join("; ")} (toolCallId=${event.toolCallId})`
  );
  return { content: newContent };
}