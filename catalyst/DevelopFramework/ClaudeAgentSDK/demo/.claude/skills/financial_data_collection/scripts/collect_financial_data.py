#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
财务数据采集主脚本

用法示例：
    python skills/financial_data_collection/scripts/collect_financial_data.py \
        --code 600519 \
        --name 贵州茅台 \
        --market A股 \
        --years 2022 2023 2024 \
        --output-dir /workspace/data/financial_statements \
        --retries 3 \
        --sleep 0.5
"""

import argparse
import json
import os
import sys

from akshare_tools import collect_company_financial_data


def parse_args():
    parser = argparse.ArgumentParser(
        description="采集上市公司财务数据（三大报表 + 财务指标）"
    )
    parser.add_argument(
        "--code",
        required=True,
        help="股票代码，纯数字，不要带 SH/SZ 前缀，例如 600519",
    )
    parser.add_argument(
        "--name",
        required=True,
        help="公司名称，例如 贵州茅台",
    )
    parser.add_argument(
        "--market",
        required=True,
        choices=["A股", "港股"],
        help="市场类型：A股 或 港股",
    )
    parser.add_argument(
        "--years",
        required=True,
        nargs="+",
        help="分析年份列表，例如 2022 2023 2024",
    )
    parser.add_argument(
        "--output-dir",
        default="/workspace/data/financial_statements",
        help="输出目录，默认为 /workspace/data/financial_statements",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.5,
        help="每次请求之间的间隔秒数，默认 0.5",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=3,
        help="akshare 接口失败时的重试次数，默认 3",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="是否输出详细日志",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    # 兼容相对路径和绝对路径
    output_dir = os.path.abspath(args.output_dir)

    print("=" * 60)
    print("财务数据采集任务")
    print("=" * 60)
    print(f"股票代码: {args.code}")
    print(f"公司名称: {args.name}")
    print(f"市场类型: {args.market}")
    print(f"分析年份: {', '.join(args.years)}")
    print(f"输出目录: {output_dir}")
    print(f"重试次数: {args.retries}")
    print("=" * 60)

    results = collect_company_financial_data(
        stock_code=args.code,
        stock_name=args.name,
        market=args.market,
        years=args.years,
        output_dir=output_dir,
        sleep_seconds=args.sleep,
        retries=args.retries,
    )

    print("\n" + "=" * 60)
    print("采集结果汇总")
    print("=" * 60)
    print(f"成功生成文件数: {len(results['files'])}")
    for f in results["files"]:
        print(f"  - {f}")

    if results["errors"]:
        print(f"\n异常/跳过项数: {len(results['errors'])}")
        for err in results["errors"]:
            print(f"  - {err}")
    else:
        print("\n无异常项")

    # 输出 JSON 结果，便于 Agent 解析
    summary_path = os.path.join(output_dir, f"{args.code}_collection_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n汇总结果已保存: {summary_path}")

    # 只要有文件生成就算部分成功
    if results["files"]:
        print("\n✅ 任务完成")
        return 0
    else:
        print("\n❌ 任务失败，未生成任何文件")
        return 1


if __name__ == "__main__":
    sys.exit(main())
