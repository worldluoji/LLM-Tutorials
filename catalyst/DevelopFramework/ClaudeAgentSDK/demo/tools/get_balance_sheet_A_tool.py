import os
import akshare as ak
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool("getbalance", "获取沪深A股公司的资产负债表，并保存到文件中，其中参数stock_code是带市场标识的股票代码，比如SH600600，参数year是年份", {"stock_code": str, "year": str})
async def get_balance_sheet_A(stock_code: str = "SH600600", year: str = "2025"):
    if not stock_code or len(stock_code) < 8:
        return {"content": [{"type": "text",
            "text": "stock_code 必须带市场前缀，如 SH600600 / SZ002261"}]}
    try:
        df_balance_sheet = ak.stock_balance_sheet_by_yearly_em(symbol=stock_code)
        if df_balance_sheet is None or df_balance_sheet.empty:
            return {"content": [{"type": "text",
                "text": f"未取到 {stock_code} 的资产负债表数据"}]}

        # 只取REPORT_DATE是2025-12-31的数据
        df_balance_sheet = df_balance_sheet[df_balance_sheet['REPORT_DATE'] == f'{year}-12-31 00:00:00']
        if df_balance_sheet.empty:
            return {"content": [{"type": "text",
                "text": f"{stock_code} 的 {year} 年资产负债表数据尚未发布或不存在"}]}

        # 获取项目根目录
        project_root = os.getcwd()

        # 创建完整的文件路径
        filepath = os.path.join(project_root, "data", "financial_statements", f"{stock_code}_{year}_资产负债表.csv")

        # 创建目录（如果不存在）
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        # 使用指定目录保存文件
        df_balance_sheet.to_csv(filepath, index=False, encoding='utf-8-sig')

        return {
            "content": [
                {"type": "text", "text": f"资产负债表已保存到: {filepath}"}
            ]
        }

    except Exception as e:
        return {
            "content": [
                {"type": "text", "text": f"获取资产负债表失败: {e}"}
            ]
        }


get_balance_sheet_A_tool_mcp = create_sdk_mcp_server(
    name="financial-tools-a",
    version="1.0.0",
    tools=[get_balance_sheet_A]
)
