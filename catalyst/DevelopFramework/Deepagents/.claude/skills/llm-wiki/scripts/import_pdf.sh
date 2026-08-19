#!/bin/bash
# import_pdf.sh — 把 raw/<file>.pdf 用 markitdown 转成 raw/<file>.md
# 用法: ./import_pdf.sh <filename.pdf>
#       ./import_pdf.sh --all    # 转换 raw/ 下所有未转换的 PDF
set -euo pipefail

PROJECT_ROOT="/Users/luoji1/code/LLM-Tutorials/catalyst/DevelopFramework/Deepagents"
KB_ROOT="${PROJECT_ROOT}/data"
RAW_DIR="${KB_ROOT}/raw"
MARKITDOWN="${PROJECT_ROOT}/demo/.venv/bin/python -m markitdown"

cd "${PROJECT_ROOT}"

convert_one() {
    local pdf_rel="$1"
    local pdf_abs="${RAW_DIR}/${pdf_rel}"
    local md_rel="${pdf_rel%.pdf}.md"
    local md_abs="${RAW_DIR}/${md_rel}"

    if [[ ! -f "${pdf_abs}" ]]; then
        echo "[skip] not found: ${pdf_rel}"
        return 1
    fi
    if [[ -f "${md_abs}" ]]; then
        echo "[skip] already converted: ${md_rel}"
        return 0
    fi

    echo "[convert] ${pdf_rel} -> ${md_rel}"
    ${MARKITDOWN} "data/raw/${pdf_rel}" -o "data/raw/${md_rel}"
}

if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <file.pdf> | --all"
    exit 1
fi

if [[ "$1" == "--all" ]]; then
    for pdf in "${RAW_DIR}"/*.pdf; do
        [[ -f "$pdf" ]] || continue
        convert_one "$(basename "$pdf")" || true
    done
else
    convert_one "$1"
fi

echo "Done."