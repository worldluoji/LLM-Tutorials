#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
财务数据 PDF 报告生成脚本

基于 financial_data_collection Skill 采集的 CSV 数据，生成结构化的 PDF 年度财务报告。

用法示例：
    python skills/financial_data_collection/scripts/generate_pdf_report.py \
        --code 002261 \
        --year 2025 \
        --data-dir /workspace/data/financial_statements \
        --output /workspace/data/financial_statements/002261_2025_annual_report.pdf

    python skills/financial_data_collection/scripts/generate_pdf_report.py \
        --code 600519 \
        --year 2024 \
        --name 贵州茅台
"""

import argparse
import csv
import os
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ============================================================
# 中文字体注册
# ============================================================

DEFAULT_FONT_CANDIDATES = [
    # macOS
    ("Heiti", "/System/Library/Fonts/STHeiti Medium.ttc"),
    ("Heiti", "/System/Library/Fonts/STHeiti Light.ttc"),
    ("Heiti", "/System/Library/Fonts/PingFang.ttc"),
    # Linux（文泉驿 / Noto）
    ("Heiti", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"),
    ("Heiti", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    # Windows
    ("Heiti", "C:\\Windows\\Fonts\\msyh.ttc"),
    ("Heiti", "C:\\Windows\\Fonts\\simhei.ttf"),
]

REGISTERED_FONT_NAME = None


def register_chinese_font(font_path: str = None):
    """注册中文字体，优先使用 --font-path 指定路径，否则依次尝试默认候选。

    返回注册的字体名（用于样式）。
    """
    global REGISTERED_FONT_NAME

    candidates = []
    if font_path:
        candidates.append(("Heiti", font_path))
    candidates.extend(DEFAULT_FONT_CANDIDATES)

    for name, path in candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                REGISTERED_FONT_NAME = name
                return name
            except Exception:
                continue

    raise RuntimeError(
        "未找到可用的中文字体，请通过 --font-path 指定一个 .ttf/.ttc 文件，"
        "或安装 wqy-zenhei / Noto Sans CJK / 苹方 / 黑体 等中文字体。"
    )


# ============================================================
# 数据加载与格式化
# ============================================================

def load_csv(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"找不到数据文件: {path}")
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        row = next(reader)
    return row


def fmt_yuan(value, scale="亿"):
    if value is None or value == "":
        return "-"
    try:
        v = float(value)
    except (ValueError, TypeError):
        return value
    if scale == "亿":
        return f"{v / 1e8:,.2f}"
    if scale == "万":
        return f"{v / 1e4:,.2f}"
    return f"{v:,.2f}"


def fmt_pct(value):
    if value is None or value == "":
        return "-"
    try:
        return f"{float(value):.2f}%"
    except (ValueError, TypeError):
        return value


def fmt_num(value, decimals=2):
    if value is None or value == "":
        return "-"
    try:
        return f"{float(value):,.{decimals}f}"
    except (ValueError, TypeError):
        return value


# ============================================================
# 样式与组件
# ============================================================

def build_styles(font_name: str):
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "TitleZH", parent=base["Title"], fontName=font_name,
            fontSize=28, leading=34, alignment=TA_CENTER, spaceAfter=20,
            textColor=colors.HexColor("#1a1a1a"),
        ),
        "subtitle": ParagraphStyle(
            "SubtitleZH", parent=base["Normal"], fontName=font_name,
            fontSize=14, leading=20, alignment=TA_CENTER,
            textColor=colors.HexColor("#666666"), spaceAfter=40,
        ),
        "h1": ParagraphStyle(
            "H1", fontName=font_name, fontSize=18, leading=24,
            textColor=colors.HexColor("#0b5394"),
            spaceBefore=18, spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "H2", fontName=font_name, fontSize=14, leading=20,
            textColor=colors.HexColor("#333333"),
            spaceBefore=10, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "Body", fontName=font_name, fontSize=11, leading=18,
            textColor=colors.HexColor("#222222"), alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "Small", fontName=font_name, fontSize=9, leading=14,
            textColor=colors.HexColor("#888888"), alignment=TA_CENTER,
        ),
        "kpi_label": ParagraphStyle(
            "KpiLabel", fontName=font_name, fontSize=11, leading=14,
            alignment=TA_CENTER, textColor=colors.HexColor("#666666"),
        ),
    }


def kpi_card_table(rows, styles):
    table_data = [
        [Paragraph(c, styles["kpi_label"]) for c in row] for row in rows
    ]
    t = Table(table_data, colWidths=[4.2 * cm] * 4)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f4f8fc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cfd9e2")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dde6ee")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def data_table(header, rows, col_widths, font_name):
    body_style = ParagraphStyle(
        "cell", fontName=font_name, fontSize=10, leading=14,
        alignment=TA_LEFT, textColor=colors.HexColor("#222"),
    )
    head_style = ParagraphStyle(
        "head", fontName=font_name, fontSize=10.5, leading=14,
        alignment=TA_CENTER, textColor=colors.white,
    )
    header_row = [Paragraph(h, head_style) for h in header]
    body_rows = [[Paragraph(c, body_style) for c in r] for r in rows]
    t = Table([header_row] + body_rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0b5394")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f7f9fc")]),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cfd9e2")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e0e6ec")),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


# ============================================================
# 报告组装
# ============================================================

def build_story(bs, is_, cf, ind, company_name, year, styles):
    font_name = styles["h1"].fontName
    story = []

    # ---------- 封面 ----------
    story.append(Spacer(1, 4 * cm))
    story.append(Paragraph(company_name, styles["title"]))
    story.append(Paragraph(f"{year} 年度财务报告", styles["subtitle"]))
    story.append(Spacer(1, 2 * cm))

    cover_meta = [
        ["证券代码", f"{bs['SECURITY_CODE']}.{bs['SECUCODE'].split('.')[-1]}"],
        ["证券简称", bs["SECURITY_NAME_ABBR"]],
        ["报告期间", f"{year}-01-01 至 {year}-12-31"],
        ["公告日期", str(bs["NOTICE_DATE"]).split(" ")[0]],
        ["审计意见", bs["OPINION_TYPE"]],
        ["货币单位", "人民币"],
    ]
    cover_table = Table(
        [[Paragraph(k, ParagraphStyle("ck", fontName=font_name, fontSize=12,
                                     textColor=colors.HexColor("#666"))),
          Paragraph(v, ParagraphStyle("cv", fontName=font_name, fontSize=12,
                                     textColor=colors.HexColor("#222")))]
         for k, v in cover_meta],
        colWidths=[4 * cm, 10 * cm],
    )
    cover_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#dddddd")),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 6 * cm))
    story.append(Paragraph("本报告由 financial-data-collection Skill 自动生成", styles["small"]))
    story.append(PageBreak())

    # ---------- 摘要 ----------
    story.append(Paragraph("一、报告摘要", styles["h1"]))
    summary = (
        f"{company_name}（{bs['SECUCODE']}）{year} 年实现营业总收入 "
        f"<b>{fmt_yuan(is_['TOTAL_OPERATE_INCOME'])} 亿元</b>，"
        f"同比 <b>{fmt_pct(is_['TOTAL_OPERATE_INCOME_YOY'])}</b>；"
        f"归属于母公司股东的净利润 "
        f"<b>{fmt_yuan(is_['PARENT_NETPROFIT'])} 亿元</b>，"
        f"同比 <b>{fmt_pct(is_['PARENT_NETPROFIT_YOY'])}</b>。"
    )
    story.append(Paragraph(summary, styles["body"]))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("核心财务指标一览", styles["h2"]))

    rev = fmt_yuan(is_["TOTAL_OPERATE_INCOME"])
    rev_yoy = fmt_pct(is_["TOTAL_OPERATE_INCOME_YOY"])
    netp = fmt_yuan(is_["PARENT_NETPROFIT"])
    netp_yoy = fmt_pct(is_["PARENT_NETPROFIT_YOY"])
    eps = fmt_num(is_["BASIC_EPS"], 4)
    eps_yoy = fmt_pct(is_["BASIC_EPS_YOY"])
    asset = fmt_yuan(bs["TOTAL_ASSETS"])
    asset_yoy = fmt_pct(bs["TOTAL_ASSETS_YOY"])
    debt_ratio = fmt_pct(ind["资产负债率(%)"])
    ocf = fmt_yuan(cf["NETCASH_OPERATE"])
    ocf_yoy = fmt_pct(cf["NETCASH_OPERATE_YOY"])
    roe = fmt_pct(ind["加权净资产收益率(%)"])
    gross = fmt_pct(ind["销售毛利率(%)"])

    story.append(kpi_card_table([
        ["营业总收入", "归母净利润", "基本每股收益", "总资产"],
        [f"{rev} 亿元", f"{netp} 亿元", f"{eps} 元", f"{asset} 亿元"],
        [f"同比 {rev_yoy}", f"同比 {netp_yoy}", f"同比 {eps_yoy}", f"同比 {asset_yoy}"],
    ], styles))

    story.append(Spacer(1, 0.3 * cm))
    story.append(kpi_card_table([
        ["加权 ROE", "销售毛利率", "资产负债率", "经营性现金流净额"],
        [roe, gross, debt_ratio, f"{ocf} 亿元"],
        ["综合盈利指标", "盈利能力指标", "偿债能力指标", f"同比 {ocf_yoy}"],
    ], styles))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(
        "<b>说明：</b>本报告所有金额单位为人民币亿元，比率为百分比。"
        "数据来源于 akshare 公开披露的财务数据，最终解释权以公司公告为准。",
        styles["body"]))
    story.append(PageBreak())

    # ---------- 利润表分析 ----------
    story.append(Paragraph("二、利润表分析", styles["h1"]))
    story.append(Paragraph(
        f"{year} 年公司主要利润表项目同比变化如下。营业总收入同比 "
        f"{fmt_pct(is_['TOTAL_OPERATE_INCOME_YOY'])}，营业成本同比 "
        f"{fmt_pct(is_['OPERATE_COST_YOY'])}，"
        f"归母净利润同比 {fmt_pct(is_['PARENT_NETPROFIT_YOY'])}。",
        styles["body"]))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("主要利润表项目（单位：亿元）", styles["h2"]))

    is_rows = [
        ["营业总收入", fmt_yuan(is_["TOTAL_OPERATE_INCOME"]), fmt_pct(is_["TOTAL_OPERATE_INCOME_YOY"])],
        ["营业成本", fmt_yuan(is_["OPERATE_COST"]), fmt_pct(is_["OPERATE_COST_YOY"])],
        ["销售费用", fmt_yuan(is_["SALE_EXPENSE"]), fmt_pct(is_["SALE_EXPENSE_YOY"])],
        ["管理费用", fmt_yuan(is_["MANAGE_EXPENSE"]), fmt_pct(is_["MANAGE_EXPENSE_YOY"])],
        ["研发费用", fmt_yuan(is_["ME_RESEARCH_EXPENSE"]), fmt_pct(is_["ME_RESEARCH_EXPENSE_YOY"])],
        ["财务费用", fmt_yuan(is_["FINANCE_EXPENSE"]), fmt_pct(is_["FINANCE_EXPENSE_YOY"])],
        ["营业利润", fmt_yuan(is_["OPERATE_PROFIT"]), fmt_pct(is_["OPERATE_PROFIT_YOY"])],
        ["利润总额", fmt_yuan(is_["TOTAL_PROFIT"]), fmt_pct(is_["TOTAL_PROFIT_YOY"])],
        ["净利润", fmt_yuan(is_["NETPROFIT"]), fmt_pct(is_["NETPROFIT_YOY"])],
        ["归母净利润", fmt_yuan(is_["PARENT_NETPROFIT"]), fmt_pct(is_["PARENT_NETPROFIT_YOY"])],
        ["扣非归母净利润", fmt_yuan(is_["DEDUCT_PARENT_NETPROFIT"]), fmt_pct(is_["DEDUCT_PARENT_NETPROFIT_YOY"])],
    ]
    story.append(data_table(
        ["项目", "金额（亿元）", "同比"],
        is_rows,
        col_widths=[5 * cm, 4 * cm, 4 * cm],
        font_name=font_name,
    ))
    story.append(PageBreak())

    # ---------- 资产负债表分析 ----------
    story.append(Paragraph("三、资产负债表分析", styles["h1"]))
    story.append(Paragraph(
        f"截至 {year}-12-31，公司总资产 {fmt_yuan(bs['TOTAL_ASSETS'])} 亿元，"
        f"较年初 {fmt_pct(bs['TOTAL_ASSETS_YOY'])}；负债合计 "
        f"{fmt_yuan(bs['TOTAL_LIABILITIES'])} 亿元，"
        f"资产负债率 {fmt_pct(ind['资产负债率(%)'])}。",
        styles["body"]))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("主要资产负债表项目（单位：亿元）", styles["h2"]))

    bs_rows = [
        ["货币资金", fmt_yuan(bs["MONETARYFUNDS"]), fmt_pct(bs["MONETARYFUNDS_YOY"])],
        ["应收账款", fmt_yuan(bs["ACCOUNTS_RECE"]), fmt_pct(bs["ACCOUNTS_RECE_YOY"])],
        ["存货", fmt_yuan(bs["INVENTORY"]), fmt_pct(bs["INVENTORY_YOY"])],
        ["流动资产合计", fmt_yuan(bs["TOTAL_CURRENT_ASSETS"]), fmt_pct(bs["TOTAL_CURRENT_ASSETS_YOY"])],
        ["总资产", fmt_yuan(bs["TOTAL_ASSETS"]), fmt_pct(bs["TOTAL_ASSETS_YOY"])],
        ["流动负债合计", fmt_yuan(bs["TOTAL_CURRENT_LIAB"]), fmt_pct(bs["TOTAL_CURRENT_LIAB_YOY"])],
        ["负债合计", fmt_yuan(bs["TOTAL_LIABILITIES"]), fmt_pct(bs["TOTAL_LIABILITIES_YOY"])],
        ["归母权益", fmt_yuan(bs["TOTAL_PARENT_EQUITY"]), fmt_pct(bs["TOTAL_PARENT_EQUITY_YOY"])],
        ["所有者权益合计", fmt_yuan(bs["TOTAL_EQUITY"]), fmt_pct(bs["TOTAL_EQUITY_YOY"])],
    ]
    story.append(data_table(
        ["项目", "金额（亿元）", "同比"],
        bs_rows,
        col_widths=[5 * cm, 4 * cm, 4 * cm],
        font_name=font_name,
    ))
    story.append(PageBreak())

    # ---------- 现金流量表分析 ----------
    story.append(Paragraph("四、现金流量表分析", styles["h1"]))
    story.append(Paragraph(
        f"{year} 年公司经营活动现金流量净额 "
        f"{fmt_yuan(cf['NETCASH_OPERATE'])} 亿元，同比 "
        f"{fmt_pct(cf['NETCASH_OPERATE_YOY'])}；"
        f"投资活动现金流量净额 {fmt_yuan(cf['NETCASH_INVEST'])} 亿元；"
        f"筹资活动现金流量净额 {fmt_yuan(cf['NETCASH_FINANCE'])} 亿元。",
        styles["body"]))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("现金流量表三大活动（单位：亿元）", styles["h2"]))

    cf_rows = [
        ["经营活动现金流入", fmt_yuan(cf["TOTAL_OPERATE_INFLOW"]), fmt_pct(cf["TOTAL_OPERATE_INFLOW_YOY"])],
        ["经营活动现金流出", fmt_yuan(cf["TOTAL_OPERATE_OUTFLOW"]), fmt_pct(cf["TOTAL_OPERATE_OUTFLOW_YOY"])],
        ["经营活动现金流量净额", fmt_yuan(cf["NETCASH_OPERATE"]), fmt_pct(cf["NETCASH_OPERATE_YOY"])],
        ["投资活动现金流量净额", fmt_yuan(cf["NETCASH_INVEST"]), fmt_pct(cf["NETCASH_INVEST_YOY"])],
        ["筹资活动现金流量净额", fmt_yuan(cf["NETCASH_FINANCE"]), fmt_pct(cf["NETCASH_FINANCE_YOY"])],
        ["现金及现金等价物净增加额", fmt_yuan(cf["CCE_ADD"]), fmt_pct(cf["CCE_ADD_YOY"])],
    ]
    story.append(data_table(
        ["项目", "金额（亿元）", "同比"],
        cf_rows,
        col_widths=[6 * cm, 4 * cm, 4 * cm],
        font_name=font_name,
    ))
    story.append(PageBreak())

    # ---------- 关键财务指标 ----------
    story.append(Paragraph("五、关键财务指标", styles["h1"]))
    story.append(Paragraph("盈利能力", styles["h2"]))

    profit_rows = [
        ["销售毛利率", fmt_pct(ind["销售毛利率(%)"])],
        ["营业利润率", fmt_pct(ind["营业利润率(%)"])],
        ["销售净利率", fmt_pct(ind["销售净利率(%)"])],
        ["净资产收益率(ROE)", fmt_pct(ind["净资产收益率(%)"])],
        ["加权净资产收益率", fmt_pct(ind["加权净资产收益率(%)"])],
        ["总资产净利润率(ROA)", fmt_pct(ind["总资产净利润率(%)"])],
    ]
    story.append(data_table(
        ["指标", "数值"],
        profit_rows,
        col_widths=[6 * cm, 4 * cm],
        font_name=font_name,
    ))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("偿债能力与营运能力", styles["h2"]))

    solvency_rows = [
        ["资产负债率", fmt_pct(ind["资产负债率(%)"])],
        ["流动比率", fmt_num(ind["流动比率"])],
        ["速动比率", fmt_num(ind["速动比率"])],
        ["应收账款周转率", fmt_num(ind["应收账款周转率(次)"]) + " 次"],
        ["存货周转天数", fmt_num(ind["存货周转天数(天)"]) + " 天"],
        ["总资产周转率", fmt_num(ind["总资产周转率(次)"]) + " 次"],
    ]
    story.append(data_table(
        ["指标", "数值"],
        solvency_rows,
        col_widths=[6 * cm, 4 * cm],
        font_name=font_name,
    ))

    story.append(Spacer(1, 0.6 * cm))
    closing = (
        "—— 报告结束 ——<br/>"
        "数据来源：akshare 公开披露的财务数据；"
        f"审计意见：{bs['OPINION_TYPE']}。"
    )
    story.append(Paragraph(closing, styles["small"]))

    return story


# ============================================================
# 入口
# ============================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description="基于财务 CSV 数据生成 PDF 年度报告",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--code", required=True,
                        help="股票代码（纯数字，如 002261 / 600519）")
    parser.add_argument("--year", required=True, type=int,
                        help="报告年份，如 2025")
    parser.add_argument("--name", default=None,
                        help="公司名称（可选，默认从 CSV 推断）")
    parser.add_argument("--data-dir", default="/workspace/data/financial_statements",
                        help="CSV 数据所在目录")
    parser.add_argument("--output", default=None,
                        help="输出 PDF 路径，默认为 <data-dir>/<code>_<year>_annual_report.pdf")
    parser.add_argument("--font-path", default=None,
                        help="中文字体 .ttf/.ttc 路径（可选，自动检测）")
    parser.add_argument("--quiet", action="store_true",
                        help="关闭 banner 输出")
    return parser.parse_args()


def main():
    args = parse_args()

    data_dir = Path(args.data_dir)
    code = args.code
    year = args.year

    # 校验四份数据齐全
    expected = {
        "资产负债表": data_dir / f"{code}_{year}_资产负债表.csv",
        "利润表": data_dir / f"{code}_{year}_利润表.csv",
        "现金流量表": data_dir / f"{code}_{year}_现金流量表.csv",
        "财务指标": data_dir / f"{code}_{year}_财务指标.csv",
    }
    missing = [(k, str(p)) for k, p in expected.items() if not p.exists()]
    if missing:
        print("❌ 以下必需数据文件缺失：", file=sys.stderr)
        for k, p in missing:
            print(f"  - {k}: {p}", file=sys.stderr)
        print("\n请先用 collect_financial_data.py 采集数据，或检查 --code/--year 是否正确。",
              file=sys.stderr)
        return 1

    output_path = (Path(args.output) if args.output
                   else data_dir / f"{code}_{year}_annual_report.pdf")

    # 加载数据
    bs = load_csv(expected["资产负债表"])
    is_ = load_csv(expected["利润表"])
    cf = load_csv(expected["现金流量表"])
    ind = load_csv(expected["财务指标"])

    company_name = args.name or bs["SECURITY_NAME_ABBR"]

    if not args.quiet:
        print("=" * 60)
        print("PDF 财务报告生成任务")
        print("=" * 60)
        print(f"股票代码: {code}")
        print(f"公司名称: {company_name}")
        print(f"报告年份: {year}")
        print(f"数据目录: {data_dir}")
        print(f"输出路径: {output_path}")
        print("=" * 60)

    # 注册字体
    try:
        font_name = register_chinese_font(args.font_path)
    except RuntimeError as e:
        print(f"❌ {e}", file=sys.stderr)
        return 1
    if not args.quiet:
        print(f"使用中文字体: {font_name}")

    # 组装并生成
    styles = build_styles(font_name)
    story = build_story(bs, is_, cf, ind, company_name, year, styles)

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title=f"{company_name} {year} 年度财务报告",
        author="financial-data-collection Skill",
    )
    doc.build(story)

    if not args.quiet:
        print(f"\n✅ PDF 已生成: {output_path}")
        print(f"   文件大小: {output_path.stat().st_size / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())