import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { promises as fs } from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const parseContractTool = defineTool({
  name: "parse_contract",
  label: "解析合同",
  description: "解析 Word/PDF/文本合同，提取纯文本和基础元数据（文件名、格式、字符数）。",
  parameters: Type.Object({
    filePath: Type.String({ description: "合同文件路径，支持 .docx/.pdf/.txt" }),
  }),
  async execute(_toolCallId, { filePath }) {
    const ext = path.extname(filePath).toLowerCase();
    let text = "";

    if (ext === ".docx") {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === ".pdf") {
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
    } else if (ext === ".txt") {
      text = await fs.readFile(filePath, "utf-8");
    } else {
      throw new Error(`不支持的文件格式: ${ext}`);
    }

    return {
      content: [
        {
          type: "text",
          text: `已解析 ${path.basename(filePath)}，格式 ${ext}，共 ${text.length} 个字符。`,
        },
      ],
      details: {
        filePath,
        fileName: path.basename(filePath),
        format: ext,
        charCount: text.length,
        text,
      },
    };
  },
});
