import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const CONTRACT_TYPES = [
  "技术服务",
  "采购供货",
  "劳务用工",
  "房屋租赁",
  "股权投资",
  "保密协议",
  "合作协议",
  "其他",
] as const;

export const classifyContractTool = defineTool({
  name: "classify_contract",
  label: "合同分类",
  description: "根据合同文本判断合同类型，并给出该类合同的典型审查重点。",
  parameters: Type.Object({
    text: Type.String({ description: "合同文本的前 3000 个字符或关键片段" }),
  }),
  async execute(_toolCallId, { text }) {
    const sample = text.slice(0, 3000);

    // 启发式分类：实际生产环境中可以让 LLM 调用此工具时由模型判断，
    // 这里提供一个快速兜底规则，避免短文本时过度依赖模型推理。
    const type = detectType(sample);
    const focusAreas = getFocusAreas(type);

    return {
      content: [
        {
          type: "text",
          text: `合同类型：${type}。审查重点：${focusAreas.join("、")}。`,
        },
      ],
      details: {
        type,
        focusAreas,
        sampleLength: sample.length,
      },
    };
  },
});

function detectType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("技术服务") || t.includes("开发") || t.includes("交付物") || t.includes("源代码")) return "技术服务";
  if (t.includes("采购") || t.includes("供货") || t.includes("买卖") || t.includes("货款")) return "采购供货";
  if (t.includes("劳务") || t.includes("用工") || t.includes("劳动合同") || t.includes("工资")) return "劳务用工";
  if (t.includes("租赁") || t.includes("房屋") || t.includes("租金") || t.includes("房东")) return "房屋租赁";
  if (t.includes("股权") || t.includes("投资") || t.includes("增资") || t.includes("估值")) return "股权投资";
  if (t.includes("保密") || t.includes("机密") || t.includes("泄露")) return "保密协议";
  if (t.includes("合作") || t.includes("框架协议") || t.includes("战略合作")) return "合作协议";
  return "其他";
}

function getFocusAreas(type: string): string[] {
  const map: Record<string, string[]> = {
    技术服务: ["知识产权归属", "交付标准", "验收条款", "违约责任"],
    采购供货: ["付款条件", "交货期限", "质量标准", "退换货条款"],
    劳务用工: ["劳动关系", "保密义务", "竞业限制", "解除条件"],
    房屋租赁: ["租金支付", "押金退还", "维修责任", "提前解约"],
    股权投资: ["估值调整", "对赌条款", "股东权利", "退出机制"],
    保密协议: ["保密范围", "保密期限", "违约责任", "例外情形"],
    合作协议: ["合作范围", "收益分配", "知识产权", "退出机制"],
    其他: ["权利义务平衡", "违约责任", "争议解决", "合同期限"],
  };
  return map[type] ?? map["其他"];
}