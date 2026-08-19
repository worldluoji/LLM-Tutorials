#!/bin/bash
# health_check.sh — Wiki 健康检查
# 检查项: wikilink 完整性 / 矛盾标注 / 资料时效 / 章节覆盖度
# 用法: ./health_check.sh
# 输出: data/.llm-wiki/health-report.md
# 注意: 不使用 set -e,因为 grep 无匹配时会返回 1
set -uo pipefail

PROJECT_ROOT="/Users/luoji1/code/LLM-Tutorials/catalyst/DevelopFramework/Deepagents"
KB_ROOT="${PROJECT_ROOT}/data"
RAW_DIR="${KB_ROOT}/raw"
WIKI_DIR="${KB_ROOT}/wiki"
WORKSPACE="${KB_ROOT}/.llm-wiki"
REPORT="${WORKSPACE}/health-report.md"
DANGLING="${WORKSPACE}/dangling-links.md"
TODAY="$(date +%Y-%m-%d)"

mkdir -p "${WORKSPACE}"

# 0. 清空旧报告
> "${REPORT}"
> "${DANGLING}"

# 1. 链接完整性 (扫描所有 [[xxx]] 是否指向已存在的文件)
echo "=== [1/4] 链接完整性 ==="
for md_file in "${WIKI_DIR}"/*.md; do
    [[ -f "$md_file" ]] || continue
    base="$(basename "$md_file" .md)"
    while IFS= read -r link; do
        # 去除 | 后面的别名
        target="${link%%|*}"
        target="${target// /}"
        # 跳过外部链接、章节锚、空
        [[ -z "$target" ]] && continue
        [[ "$target" =~ ^https?:// ]] && continue
        [[ "$target" =~ ^# ]] && continue

        target_file="${WIKI_DIR}/${target}.md"
        if [[ ! -f "${target_file}" ]]; then
            echo "- [[${target}]] (来自 [[${base}]])" >> "${DANGLING}"
        fi
    done < <(grep -oE '\[\[[^]]+\]\]' "$md_file" 2>/dev/null | sed 's/\[\[//;s/\]\]//' || true)
done

dangling_count=$(wc -l < "${DANGLING}" | tr -d ' ')
echo "  -> dangling links: ${dangling_count}"

# 2. 矛盾标注 (扫描 ⚠️ 矛盾标注 区块)
echo "=== [2/4] 矛盾标注 ==="
conflict_count=$(grep -lE '## ⚠️ 矛盾标注' "${WIKI_DIR}"/*.md 2>/dev/null | wc -l | tr -d ' ')
conflict_files=$(grep -lE '## ⚠️ 矛盾标注' "${WIKI_DIR}"/*.md 2>/dev/null | xargs -I {} basename {} .md || true)
echo "  -> pages with conflict blocks: ${conflict_count}"

# 3. 时效性 (资料摘要 report_date 距今超过 365 天)
echo "=== [3/4] 时效性 ==="
> "${WORKSPACE}/outdated-sources.md"
for src in "${WIKI_DIR}"/source-*.md; do
    [[ -f "$src" ]] || continue
    date_str=$(grep -E '^report_date:' "$src" | head -1 | sed 's/^report_date: *//;s/ *"//g;s/" *$//' || true)
    [[ -z "$date_str" ]] && continue
    # macOS 与 Linux date 兼容
    if date -d "$date_str" +%s >/dev/null 2>&1; then
        ts=$(date -d "$date_str" +%s)
    elif date -j -f "%Y-%m-%d" "$date_str" +%s >/dev/null 2>&1; then
        ts=$(date -j -f "%Y-%m-%d" "$date_str" +%s)
    else
        continue
    fi
    now=$(date +%s)
    days=$(( (now - ts) / 86400 ))
    if (( days > 365 )); then
        echo "- [[$(basename "$src" .md)]] 报告日期 ${date_str} (${days} 天前)" >> "${WORKSPACE}/outdated-sources.md"
    fi
done
outdated_count=$(wc -l < "${WORKSPACE}/outdated-sources.md" | tr -d ' ')
echo "  -> outdated sources: ${outdated_count}"

# 4. 章节覆盖度 (个股页必须含固定章节)
echo "=== [4/4] 章节覆盖度 ==="
> "${WORKSPACE}/missing-sections.md"
required=("## 公司画像" "## 核心数据" "## 业务结构" "## 投资逻辑" "## 关键风险" "## 来源链接")
for stock in "${WIKI_DIR}"/[0-9]*.md; do
    [[ -f "$stock" ]] || continue
    name="$(basename "$stock" .md)"
    for section in "${required[@]}"; do
        if ! grep -qF "$section" "$stock"; then
            echo "- [[${name}]] 缺少章节: ${section}" >> "${WORKSPACE}/missing-sections.md"
        fi
    done
done
missing_count=$(wc -l < "${WORKSPACE}/missing-sections.md" | tr -d ' ')
echo "  -> missing sections: ${missing_count}"

# 5. 生成汇总报告
cat > "${REPORT}" <<EOF
# Wiki 健康检查报告

- **检查时间**：${TODAY}
- **Wiki 页面数**：$(ls "${WIKI_DIR}"/*.md 2>/dev/null | wc -l | tr -d ' ')
- **原始资料数**：$(ls "${RAW_DIR}"/*.pdf 2>/dev/null | wc -l | tr -d ' ') (PDF)

## 汇总

| 检查项 | 问题数 | 详细 |
|--------|--------|------|
| 链接完整性 | ${dangling_count} | [dangling-links.md](./dangling-links.md) |
| 矛盾标注 | ${conflict_count} | 见下 |
| 资料时效 | ${outdated_count} | [outdated-sources.md](./outdated-sources.md) |
| 章节覆盖 | ${missing_count} | [missing-sections.md](./missing-sections.md) |

## 矛盾标注页面

${conflict_files:-（无）}

EOF

echo "=== 报告生成 ==="
echo "  -> ${REPORT}"
echo "Done."