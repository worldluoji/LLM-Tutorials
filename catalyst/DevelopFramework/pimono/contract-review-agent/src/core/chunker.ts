export interface ContractChunk {
  index: number;
  content: string;
  estimatedTokens: number;
}

export function chunkContract(text: string, maxChars = 6000): ContractChunk[] {
  const clauses = text.split(/\n(?=第[一二三四五六七八九十]+章|\d+\.\s|第\d+条)/);
  const chunks: string[] = [];
  let current = "";

  for (const clause of clauses) {
    if (current.length + clause.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += clause + "\n";
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.map((content, index) => ({
    index,
    content,
    estimatedTokens: Math.ceil(content.length / 2.5),
  }));
}
