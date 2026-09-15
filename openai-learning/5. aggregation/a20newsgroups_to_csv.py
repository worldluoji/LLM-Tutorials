from sklearn.datasets import fetch_20newsgroups  # 常用的 20 newsgroups 数据集，预先分好类的英文新闻组数据
import pandas as pd


def twenty_newsgroup_to_csv():
    newsgroups_train = fetch_20newsgroups(subset='train', remove=('headers', 'footers', 'quotes'))

    # https://www.runoob.com/pandas/pandas-dataframe.html
    df = pd.DataFrame([newsgroups_train.data, newsgroups_train.target.tolist()]).T
    df.columns = ['text', 'target']

    targets = pd.DataFrame(newsgroups_train.target_names, columns=['title'])

    # left_on：左侧DataFrame中用作连接键的列名; right_index：使用右则DataFrame中的行索引做为连接键
    out = pd.merge(df, targets, left_on='target', right_index=True)
    out.to_csv('20_newsgroup.csv', index=False)

twenty_newsgroup_to_csv()
