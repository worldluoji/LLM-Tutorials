import akshare as ak
import pandas as pd

df = ak.stock_yjbb_em(date="20241231")

df.to_csv('financial_report.csv')