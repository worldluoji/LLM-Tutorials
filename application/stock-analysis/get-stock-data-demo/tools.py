from langchain_core.tools import tool
import akshare as ak

@tool
def get_stock_info(code: str, name: str) -> str:
    """可以根据传入的股票代码或股票名称获取股票信息
    Args:
        code: 股票代码
        name: 股票名称
    """
    code_isempty = (code == "" or len(code) <= 2)
    name_isempty = (name == "" or len(name) <= 2)

    if code_isempty and name_isempty:
        return []
    
    df = ak.stock_cy_a_spot_em() # 获取创业板股票列表

    ret = None
    if code_isempty and not name_isempty:
        ret = df[df['名称'].str.contains(name)]
    elif not code_isempty and name_isempty:
        ret = df[df['代码'].str.contains(code)]
    else:
        ret = df[df['代码'].str.contains(code) & df['名称'].str.contains(name)]

    return ret.to_dict(orient='records')