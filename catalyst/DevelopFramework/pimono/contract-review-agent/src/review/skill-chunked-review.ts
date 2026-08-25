import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { chunkContract } from "../core/chunker.js";
import { calculateOverallScore } from "../core/risk-scorer.js";
import type { RiskItem } from "../core/types/contract.js";

export async function reviewWithSkill(
  session: AgentSession,
  contractText: string,
): Promise<{ score: "A" | "B" | "C" | "D"; risks: RiskItem[]; summary: string }> {
  const chunks = chunkContract(contractText);
  const allRisks: RiskItem[] = [];

  for (const chunk of chunks) {
    const prompt =
      `/skill:contract-risk-review-claw 请使用 JSON 输出模式审查以下合同第 ${chunk.index + 1}/${chunks.length} 部分。\n` +
      `只返回 JSON 数组，不要任何 markdown 报告、解释或代码块。\n` +
      `每个元素包含 level（high/medium/low）、type、clause、originalText、suggestion。\n` +
      `如果没有风险，返回空数组 []。\n\n` +
      chunk.content;

    await session.prompt(prompt);
    const last = session.messages.at(-1);

    if (last?.role === "assistant" && last.stopReason !== "error") {
      const text = last.content
        .filter((c) => c.type === "text")
        .map((c) => (c as any).text)
        .join("");
      const risks = extractRisksFromJson(text);
      allRisks.push(...risks);
    }
  }

  const score = calculateOverallScore(allRisks);
  const high = allRisks.filter((r) => r.level === "high").length;
  const medium = allRisks.filter((r) => r.level === "medium").length;
  const low = allRisks.filter((r) => r.level === "low").length;

  return {
    score,
    risks: allRisks,
    summary: `高风险 ${high} 处 / 中风险 ${medium} 处 / 低风险 ${low} 处`,
  };
}

function extractRisksFromJson(text: string): RiskItem[] {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as RiskItem[];
  } catch {
    return [];
  }
}
