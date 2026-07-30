---
name: financial-data-collection
description: |
  采集中国 A 股和港股上市公司的财务数据，包括资产负债表、利润表、现金流量表和财务指标。
  当用户提到财务数据、财报、三大报表、财务指标、akshare、上市公司财务、股票财务数据、
  竞争对手财务数据、年报数据、采集财务数据等任何与财务数据采集相关的需求时，务必使用此 skill。
  本 skill 提供标准化脚本，将数据保存为 utf-8-sig 编码的 CSV，供后续计算和分析使用。
compatibility: |
  - Python 3.9+
  - 依赖：akshare, pandas, numpy, openpyxl
  - 适用于 Claude Managed Agents 的 bash / code_execution 工具环境
  - 默认输出目录：/workspace/data/financial_statements
---

# 财务数据采集技能 (Financial Data Collection)

## 用途

本 skill 用于采集中国 A 股和港股上市公司的财务数据，具体包括：

- **资产负债表**：资产、负债、所有者权益等科目
- **利润表**：营业收入、成本、利润等科目
- **现金流量表**：经营、投资、筹资活动现金流
- **财务指标**：盈利能力、偿债能力、运营能力、成长能力等综合指标

采集结果以标准化 CSV 格式保存，可直接用于后续的财务指标计算、趋势分析、对比分析和估值建模。

## 何时使用此 skill

只要用户任务涉及以下内容，就应当使用本 skill：

- 采集/获取/下载上市公司财务数据
- 三大报表、年报、财务报表
- 财务指标、财务比率
- 贵州茅台、五粮液等具体公司财务数据
- 竞争对手财务数据对比
- 使用 akshare 获取财经数据
- 为财务分析、研报生成准备数据

## 输入要求

调用主脚本 `scripts/collect_financial_data.py` 时需要以下参数：

| 参数 | 必填 | 说明 | 示例 |
|---|---|---|---|
| `--code` | 是 | 股票代码（纯数字，不要带 SH/SZ/ HK 前缀） | `600519` |
| `--name` | 是 | 公司名称（用于日志和报告） | `贵州茅台` |
| `--market` | 是 | 市场类型 | `A股` 或 `港股` |
| `--years` | 是 | 分析年份，可多个 | `2022 2023 2024` |
| `--output-dir` | 否 | 输出目录 | 默认 `/workspace/data/financial_statements` |
| `--sleep` | 否 | 请求间隔秒数 | 默认 `0.5` |
| `--retries` | 否 | 失败重试次数 | 默认 `3` |
| `--verbose` | 否 | 是否输出详细日志 | 默认关闭 |

## 输出产物

脚本执行后会在输出目录生成以下文件：

```
{output_dir}/
├── {code}_{year}_资产负债表.csv
├── {code}_{year}_利润表.csv
├── {code}_{year}_现金流量表.csv
├── {code}_{year}_财务指标.csv
└── {code}_collection_summary.json
```

例如贵州茅台 2022-2024 年的输出：

```
600519_2022_资产负债表.csv
600519_2022_利润表.csv
600519_2022_现金流量表.csv
600519_2022_财务指标.csv
600519_2023_资产负债表.csv
...
600519_collection_summary.json
```

`{code}_collection_summary.json` 包含本次采集的成功文件列表和错误/跳过项，便于 Agent 检查是否完整。

## 快速开始

### 1. 安装依赖

```bash
pip install -r skills/financial_data_collection/requirements.txt
```

### 2. 采集单公司数据

```bash
python skills/financial_data_collection/scripts/collect_financial_data.py \
  --code 600519 \
  --name 贵州茅台 \
  --market A股 \
  --years 2022 2023 2024
```

### 3. 采集竞争对手数据

对每一家竞争对手公司分别执行上述命令，仅替换 `--code`、`--name` 参数即可。

例如：

```bash
python skills/financial_data_collection/scripts/collect_financial_data.py --code 000858 --name 五粮液 --market A股 --years 2022 2023 2024
python skills/financial_data_collection/scripts/collect_financial_data.py --code 000568 --name 泸州老窖 --market A股 --years 2022 2023 2024
python skills/financial_data_collection/scripts/collect_financial_data.py --code 600809 --name 山西汾酒 --market A股 --years 2022 2023 2024
```

## 数据标准化规则

1. **A 股代码处理**：调用 akshare 时自动补全 `SH`/`SZ` 前缀，保存文件名时去掉前缀
2. **港股代码处理**：使用纯数字代码（当前版本港股支持有限，优先 A 股）
3. **只保留年报数据**：过滤报告日期为 `{year}-12-31` 的数据
4. **编码统一**：所有 CSV 使用 `utf-8-sig` 编码，方便 Excel 直接打开
5. **表头保留中文**：不修改原始列名，下游计算 skill 依赖这些列名
6. **失败不中断**：若某一年度或某张表缺失，记录错误并继续处理其他年份
7. **自动重试**：akshare 接口偶发失败时自动重试，最多 3 次

## 工作流建议

对于一份完整的财务研报，建议按以下顺序使用本 skill：

1. 先使用本 skill 采集目标公司的多年度财务数据
2. 再使用本 skill 采集所有竞争对手公司的多年度财务数据
3. 检查每个公司是否都生成了 4 × N 个 CSV 文件（N 为年数）
4. 阅读 `{code}_collection_summary.json` 确认无严重错误
5. 将输出目录交给下一个 skill（财务指标计算）继续处理

## 常见错误与处理

| 问题 | 解决方案 |
|---|---|
| `akshare` 接口返回空数据 | 检查网络连接；脚本会自动重试；若确实无数据则跳过该年度 |
| 报告日期格式不匹配 | 脚本会自动尝试 `YYYY-12-31 00:00:00` 和 `YYYY-12-31` 两种格式 |
| 港股数据获取失败 | 当前版本优先支持 A 股；如需港股请扩展 `scripts/akshare_tools.py` |
| 输出目录不存在 | 脚本会自动创建 |
| 部分年度缺失 | 属于正常情况，记录到 summary.json 中，下游 skill 应能处理缺失 |

## 文件结构

```
skills/financial_data_collection/
├── SKILL.md                          # 本说明文件
├── requirements.txt                  # Python 依赖
└── scripts/
    ├── collect_financial_data.py     # 主入口脚本
    └── akshare_tools.py              # akshare 数据采集工具函数
```

## 扩展指南

如果需要支持更多市场或更多数据源：

1. 在 `scripts/akshare_tools.py` 中添加新的采集函数
2. 在 `collect_company_financial_data` 函数中添加对应 market 的分支
3. 更新 `SKILL.md` 中的输入参数和输出产物说明

## 安全与合规

1. 本 skill 只读取公开披露的财务数据，不进行交易、下单等敏感操作
2. 采集大量数据时保持合理请求间隔，避免对数据源造成压力
3. 不要在脚本中硬编码 API 密钥或敏感信息
