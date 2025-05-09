import asyncio
from typing import List
import akshare as ak
import pandas as pd

import os,re

FILE_PATH="/Users/luke-surface-mac/code/AI-Drawing-Tutorials/application/stock-analysis/get-stock-data-demo/data"

async def save_data(codes:List[str], start_date:str, end_date:str):
    all_data= pd.DataFrame()
    tasklist=[]
    for code in codes:
        task=asyncio.create_task(load_data(code,start_date,end_date))
        tasklist.append(task)
    
    # *tasklist is used to unpack the list of tasks (tasklist) into individual arguments for asyncio.gather.
    ret=await asyncio.gather(*tasklist)

    for r in ret:
        # axis=0 specifies that the concatenation should happen row-wise.
        all_data=pd.concat([all_data, r],axis=0)

    filename="{}_{}".format(start_date,end_date)
    all_data.to_csv(f"{FILE_PATH}{os.sep}data{filename}")
    print("保存所有日线数据完成,文件名是:{}".format(filename))

async def load_data(symbol, start_date, end_date):
    # 由于 akshare 的 API 是同步的，我们需要在线程池中运行它
    loop = asyncio.get_event_loop()
    '''
    When set to None, it defaults to the default thread pool executor provided by the event loop.
    
    If a custom thread pool or executor is needed, you can pass it as the first argument. 

    from concurrent.futures import ThreadPoolExecutor
    executor = ThreadPoolExecutor()
    df = await loop.run_in_executor(executor, lambda: ak.stock_zh_a_hist(...))
    '''
    df = await loop.run_in_executor(None, lambda: ak.stock_zh_a_hist(
        symbol=symbol, 
        period="daily", 
        start_date=start_date, 
        end_date=end_date, 
        adjust="qfq"
    ))

    df['日期'] = pd.to_datetime(df['日期'])
    df.set_index('日期', inplace=True)
    df.sort_index(ascending=False, inplace=True)

    return df

# 获取所有股票代码
def get_all_codes():
    df=ak.stock_zh_a_spot_em()
    codes=df['代码']
    bool_list=df['代码'].str.startswith(('60','30','00','68'))
    return codes[bool_list].to_list()


# 分文件保存
def save_all_data():
    codes=get_all_codes()
    print("共有{}个股票需要抓取".format(len(codes)))
    n=100
    for i in range(0, len(codes), n):
        subset = codes[i:i + n]
        if len(subset) > 0:
            asyncio.run(save_data(subset,'20230422','20250422',
                                  prefix=f"{i}_"))
            print("抓取了{}".format(i))


# 读取csv文件
def load_df(file:str)->pd.DataFrame:
     df=pd.read_csv(f"{FILE_PATH}{os.sep}{file}")
     if df.empty:
         raise Exception("文件不存在")
     df['日期'] = pd.to_datetime(df['日期'])
     df['股票代码']=df['股票代码'].astype(str)
     return df

# 合并多个csv文件
def concat_csv(file_name:str):
    # 列出文件夹中的所有文件和目录
    files = os.listdir(FILE_PATH)
    # 定义一个正则表达式，匹配以数字开头的文件名
    pattern = re.compile(r'^\d+_.+\.csv$')
    # 遍历文件，筛选出符合条件的文件名
    filtered_files = [file for file in files if pattern.match(file)]
    ret=pd.DataFrame()
    # 打印结果
    for file in filtered_files:
        df=load_df(file)
        ret=pd.concat([ret,df])
    ret.to_csv(f"{FILE_PATH}{os.sep}{file_name}")
    print("合并完成,文件名是{}".format(file_name))



if __name__ == "__main__":
    asyncio.run(save_data(["300750", "600519"], "20250407", "20250411"))