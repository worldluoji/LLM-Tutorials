# -*- coding: utf-8 -*-
"""
akshare 财务数据采集工具函数
用于采集中国 A 股和港股上市公司的三大报表及财务指标
"""

import os
import time
from typing import Callable, Optional

import akshare as ak
import pandas as pd


def normalize_a_share_code(stock_code: str) -> str:
    """
    将纯数字 A 股代码转换为带市场前缀的格式（SH600519 / SZ000001）
    """
    code = str(stock_code).strip()
    if code.startswith(("SH", "SZ", "sh", "sz")):
        return code.upper()
    # 6 开头为沪市，其余为深市
    if code.startswith("6"):
        return f"SH{code}"
    return f"SZ{code}"


def clean_a_share_code(stock_code: str) -> str:
    """
    去掉 SH/SZ 前缀，返回纯数字代码
    """
    code = str(stock_code).strip().upper()
    if code.startswith(("SH", "SZ")):
        return code[2:]
    return code


def ensure_dir(path: str) -> None:
    """确保目录存在"""
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)


def save_dataframe(df: pd.DataFrame, filepath: str) -> None:
    """保存 DataFrame 为 utf-8-sig 编码的 CSV"""
    df.to_csv(filepath, index=False, encoding="utf-8-sig")


def filter_annual_report(df: pd.DataFrame, year: str, date_column: str) -> pd.DataFrame:
    """
    从 DataFrame 中筛选出指定年份的年报数据
    兼容 akshare 不同接口返回的多种日期格式
    """
    if df is None or df.empty:
        return pd.DataFrame()

    if date_column not in df.columns:
        print(f"[警告] 数据中不存在日期列 '{date_column}'，可用列: {list(df.columns)}")
        return pd.DataFrame()

    target_patterns = [
        f"{year}-12-31 00:00:00",
        f"{year}-12-31",
    ]

    # 将日期列统一转为字符串
    date_values = df[date_column].astype(str)
    mask = date_values.isin(target_patterns)
    return df[mask].copy()


def retry_call(func: Callable, retries: int = 3, sleep_seconds: float = 0.5):
    """
    包装函数调用，失败时自动重试
    """
    last_exception = None
    for attempt in range(retries):
        try:
            return func()
        except Exception as e:
            last_exception = e
            print(f"[重试 {attempt + 1}/{retries}] 调用失败: {e}")
            if attempt < retries - 1:
                time.sleep(sleep_seconds * (attempt + 1))
    raise last_exception


def get_balance_sheet(stock_code: str, year: str, retries: int = 3) -> Optional[pd.DataFrame]:
    """
    获取 A 股资产负债表
    :param stock_code: 带 SH/SZ 前缀的 A 股代码
    :param year: 年份，如 2024
    :return: DataFrame 或 None
    """
    try:
        df = retry_call(
            lambda: ak.stock_balance_sheet_by_yearly_em(symbol=stock_code),
            retries=retries,
        )
        return filter_annual_report(df, year, date_column="REPORT_DATE")
    except Exception as e:
        print(f"[错误] 获取资产负债表失败 ({stock_code}, {year}): {e}")
        return None


def get_income_statement(stock_code: str, year: str, retries: int = 3) -> Optional[pd.DataFrame]:
    """
    获取 A 股利润表
    """
    try:
        df = retry_call(
            lambda: ak.stock_profit_sheet_by_yearly_em(symbol=stock_code),
            retries=retries,
        )
        return filter_annual_report(df, year, date_column="REPORT_DATE")
    except Exception as e:
        print(f"[错误] 获取利润表失败 ({stock_code}, {year}): {e}")
        return None


def get_cash_flow_statement(stock_code: str, year: str, retries: int = 3) -> Optional[pd.DataFrame]:
    """
    获取 A 股现金流量表
    """
    try:
        df = retry_call(
            lambda: ak.stock_cash_flow_sheet_by_yearly_em(symbol=stock_code),
            retries=retries,
        )
        return filter_annual_report(df, year, date_column="REPORT_DATE")
    except Exception as e:
        print(f"[错误] 获取现金流量表失败 ({stock_code}, {year}): {e}")
        return None


def get_financial_indicator(stock_code: str, year: str, retries: int = 3) -> Optional[pd.DataFrame]:
    """
    获取 A 股财务指标
    :param stock_code: 纯数字 A 股代码
    :param year: 年份
    """
    clean_code = clean_a_share_code(stock_code)
    try:
        df = retry_call(
            lambda: ak.stock_financial_analysis_indicator(symbol=clean_code, start_year=year),
            retries=retries,
        )
        return filter_annual_report(df, year, date_column="日期")
    except Exception as e:
        print(f"[错误] 获取财务指标失败 ({clean_code}, {year}): {e}")
        return None


def save_statement_if_valid(
    df: Optional[pd.DataFrame],
    output_dir: str,
    clean_code: str,
    year: str,
    statement_name: str,
    results: dict,
) -> None:
    """
    如果 DataFrame 有效则保存，否则记录错误
    """
    if df is not None and not df.empty:
        path = os.path.join(output_dir, f"{clean_code}_{year}_{statement_name}.csv")
        save_dataframe(df, path)
        results["files"].append(path)
        print(f"  ✅ {statement_name}已保存: {path}")
    else:
        msg = f"{clean_code} {year} {statement_name}无数据"
        results["errors"].append(msg)
        print(f"  ⚠️ {msg}")


def collect_company_financial_data(
    stock_code: str,
    stock_name: str,
    market: str,
    years: list[str],
    output_dir: str,
    sleep_seconds: float = 0.5,
    retries: int = 3,
) -> dict:
    """
    采集一家公司的全部财务数据
    :return: {"success": bool, "files": list, "errors": list}
    """
    ensure_dir(output_dir)
    results = {"success": True, "files": [], "errors": []}
    clean_code = clean_a_share_code(stock_code)

    for year in years:
        print(f"\n[开始] 采集 {stock_name}({clean_code}) {year} 年度财务数据...")

        if market == "A股":
            prefixed_code = normalize_a_share_code(stock_code)

            # 资产负债表
            df_zcfz = get_balance_sheet(prefixed_code, year, retries=retries)
            save_statement_if_valid(df_zcfz, output_dir, clean_code, year, "资产负债表", results)
            time.sleep(sleep_seconds)

            # 利润表
            df_lrb = get_income_statement(prefixed_code, year, retries=retries)
            save_statement_if_valid(df_lrb, output_dir, clean_code, year, "利润表", results)
            time.sleep(sleep_seconds)

            # 现金流量表
            df_xjll = get_cash_flow_statement(prefixed_code, year, retries=retries)
            save_statement_if_valid(df_xjll, output_dir, clean_code, year, "现金流量表", results)
            time.sleep(sleep_seconds)

            # 财务指标
            df_zb = get_financial_indicator(clean_code, year, retries=retries)
            save_statement_if_valid(df_zb, output_dir, clean_code, year, "财务指标", results)
            time.sleep(sleep_seconds)

        elif market == "港股":
            msg = f"港股数据采集暂未实现: {stock_name}({clean_code})"
            results["errors"].append(msg)
            print(f"  ⚠️ {msg}")
        else:
            msg = f"不支持的市场类型: {market}"
            results["errors"].append(msg)
            print(f"  ❌ {msg}")

    if results["errors"]:
        results["success"] = False

    return results


def read_csv_as_text(filepath: str, max_rows: Optional[int] = None) -> str:
    """
    读取 CSV 并格式化为 LLM 易读的文本
    """
    try:
        df = pd.read_csv(filepath, encoding="utf-8-sig")
        if max_rows:
            df = df.head(max_rows)
        return df.to_string(index=False)
    except Exception as e:
        return f"[读取失败] {filepath}: {e}"
