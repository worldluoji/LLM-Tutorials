export type RiskLevel = "high" | "medium" | "low";

export type RiskType =
  | "不平等条款"
  | "违约责任失衡"
  | "知识产权陷阱"
  | "管辖权不利"
  | "表述模糊"
  | "隐藏义务";

export interface RiskItem {
  level: RiskLevel;
  type: RiskType;
  clause: string;
  originalText: string;
  suggestion: string;
  replacement?: string;
}
