import type { RiskItem } from "./types/contract.js";

export function calculateOverallScore(risks: RiskItem[]): "A" | "B" | "C" | "D" {
  const high = risks.filter((r) => r.level === "high").length;
  const medium = risks.filter((r) => r.level === "medium").length;

  if (high >= 3 || high + medium >= 8) return "D";
  if (high >= 1 || medium >= 4) return "C";
  if (medium >= 1) return "B";
  return "A";
}

export function summarizeRisks(risks: RiskItem[]): string {
  const high = risks.filter((r) => r.level === "high").length;
  const medium = risks.filter((r) => r.level === "medium").length;
  const low = risks.filter((r) => r.level === "low").length;
  return `高风险 ${high} 处 / 中风险 ${medium} 处 / 低风险 ${low} 处`;
}
