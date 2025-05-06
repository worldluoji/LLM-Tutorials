import akshare as ak
def main():
    # 300750是宁德时代股票代码
    df = ak.stock_zh_a_hist(symbol="300750", 
                            period="daily", 
                            start_date="20250421", 
                            end_date='20250425', 
                            adjust="qfq")
    print(df)

    # 可以保存到csv文件以便后续使用
    # df.to_csv('300750.csv', index=False)


if __name__ == "__main__":
    main()
