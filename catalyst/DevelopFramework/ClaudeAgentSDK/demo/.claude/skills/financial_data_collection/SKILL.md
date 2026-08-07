---
name: financial-data-collection
description: |
  采集中国 A 股和港股上市公司的财务数据（资产负债表/利润表/现金流量表/财务指标），
  并可基于采集结果一键生成结构化的 PDF 年度财务报告。
  使用场景：财务数据采集、财报、三大报表、财务指标、akshare、上市公司财务、
  股票财务数据、年报数据、生成 PDF 财务报告、财务分析报告、研报素材、对比分析。
  本 skill 提供标准化脚本，CSV 输出 utf-8-sig 编码，PDF 自动适配中文字体。
  不要用于：实时行情数据、非财务报表（ESG/治理报告等）、非财务类 PDF（合同/招股书等）。
compatibility: |
  - Python 3.9+
  - 采集阶段依赖：akshare, pandas, numpy, openpyxl
  - PDF 阶段依赖：reportlab>=4.0.0
  - 适用于 Claude Managed Agents 的 bash / code_execution 工具环境
  - 默认输出目录：/workspace/data/financial_statements
  - 中文字体：自动检测 macOS STHeiti/PingFang、Linux Noto CJK/WQY、Windows 微软雅黑/黑体；可通过 --font-path 指定
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
- **生成 PDF 财务报告 / 年度报告 / 财报 PDF / 财务分析 PDF**

## 脚本一：collect_financial_data.py — 财务数据采集

### 输入参数

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

---

## 脚本二：generate_pdf_report.py — PDF 财务报告生成

在完成数据采集后，可直接基于 CSV 生成结构化的 PDF 年度报告。报告包含封面、报告摘要、利润表分析、资产负债表分析、现金流量表分析、关键财务指标共 6 个章节。

### 前置条件

执行前必须存在以下 4 个 CSV（由脚本一生成）：

```
{code}_{year}_资产负债表.csv
{code}_{year}_利润表.csv
{code}_{year}_现金流量表.csv
{code}_{year}_财务指标.csv
```

脚本会**逐一校验**这些文件是否存在，缺一即报错退出，不会生成半成品 PDF。

### 输入参数

| 参数 | 必填 | 说明 | 示例 |
|---|---|---|---|
| `--code` | 是 | 股票代码（纯数字） | `002261` |
| `--year` | 是 | 报告年份（整数） | `2025` |
| `--name` | 否 | 公司名称；默认从资产负债表 CSV 自动推断 | `拓维信息` |
| `--data-dir` | 否 | CSV 数据所在目录 | 默认 `/workspace/data/financial_statements` |
| `--output` | 否 | PDF 输出路径 | 默认 `<data-dir>/<code>_<year>_annual_report.pdf` |
| `--font-path` | 否 | 中文字体 .ttf/.ttc 路径 | 自动检测系统字体 |
| `--quiet` | 否 | 关闭 banner 输出 | 默认开启 |

### 中文字体自动检测

脚本按以下顺序查找字体（找到第一个可用即用）：

| 平台 | 候选路径 |
|---|---|
| macOS | `/System/Library/Fonts/STHeiti Medium.ttc` → `STHeiti Light.ttc` → `PingFang.ttc` |
| Linux | `/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc` → `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc` |
| Windows | `C:\Windows\Fonts\msyh.ttc` → `simhei.ttf` |

如需自定义字体（如公司品牌字体），通过 `--font-path /path/to/font.ttf` 指定。

### 输出产物

```
{output_dir}/{code}_{year}_annual_report.pdf
```

约 80-150 KB（取决于数据规模），典型 5-7 页 A4。

### 报告内容结构

| 章节 | 内容 |
|---|---|
| 封面 | 公司名、报告标题、证券代码、报告期间、公告日期、审计意见 |
| 一、报告摘要 | 核心叙述 + 8 个 KPI 卡片（营收/净利/EPS/资产/ROE/毛利率/负债率/经营现金流） |
| 二、利润表分析 | 11 个主要科目同比表 |
| 三、资产负债表分析 | 9 个主要科目同比表 |
| 四、现金流量表分析 | 6 个核心现金流科目同比表 |
| 五、关键财务指标 | 12 个盈利能力 + 偿债能力 + 营运能力指标 |

### 使用示例

```bash
# 最简用法：自动从 data-dir 推断所有参数
python .claude/skills/financial_data_collection/scripts/generate_pdf_report.py \
  --code 002261 \
  --year 2025

# 指定公司名 + 自定义字体
python .claude/skills/financial_data_collection/scripts/generate_pdf_report.py \
  --code 002261 \
  --year 2025 \
  --name 拓维信息 \
  --font-path /usr/share/fonts/truetype/wqy/wqy-zenhei.ttc

# 自定义输出路径
python .claude/skills/financial_data_collection/scripts/generate_pdf_report.py \
  --code 600519 \
  --year 2024 \
  --output /tmp/maotai_2024_report.pdf
```

### 退出码

| Code | 含义 |
|---|---|
| 0 | PDF 生成成功 |
| 1 | 数据文件缺失 / 字体加载失败 / 其他错误（stderr 含详细原因） |

> **与脚本一的协作**：脚本二不会重新调用 akshare 网络接口，完全离线运行，可重复执行。

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

### 4. 基于采集数据生成 PDF 报告

```bash
python .claude/skills/financial_data_collection/scripts/generate_pdf_report.py \
  --code 002261 \
  --year 2025 \
  --name 拓维信息
```

生成的 PDF 默认保存在 `--data-dir` 下：

```
{code}_{year}_annual_report.pdf
```

> 注意：PDF 阶段依赖 `reportlab`，可通过 `pip install -r skills/financial_data_collection/requirements.txt` 一次性安装所有依赖。

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
5. 如需 PDF 报告：对每家公司调用 `generate_pdf_report.py` 生成独立 PDF
6. 将输出目录（CSV + PDF）交给下一个 skill（财务指标计算 / 估值建模等）继续处理

典型 `采集 → 报告` 一体化工作流：

```bash
# 1. 批量采集（多家公司 × 多年）
for code_name in "600519:贵州茅台" "000858:五粮液" "000568:泸州老窖"; do
  code=${code_name%%:*}; name=${code_name##*:}
  python .claude/skills/financial_data_collection/scripts/collect_financial_data.py \
    --code $code --name "$name" --market A股 --years 2023 2024 2025
done

# 2. 批量生成 PDF
for code in 600519 000858 000568; do
  python .claude/skills/financial_data_collection/scripts/generate_pdf_report.py \
    --code $code --year 2025
done
```

## 常见错误与处理

| 问题 | 解决方案 |
|---|---|
| `akshare` 接口返回空数据 | 检查网络连接；脚本会自动重试；若确实无数据则跳过该年度 |
| 报告日期格式不匹配 | 脚本会自动尝试 `YYYY-12-31 00:00:00` 和 `YYYY-12-31` 两种格式 |
| 港股数据获取失败 | 当前版本优先支持 A 股；如需港股请扩展 `scripts/akshare_tools.py` |
| 输出目录不存在 | 脚本会自动创建 |
| 部分年度缺失 | 属于正常情况，记录到 summary.json 中，下游 skill 应能处理缺失 |
| PDF 脚本报"数据文件缺失" | 先确认 4 个 CSV 都在 `--data-dir` 下；文件名需匹配 `{code}_{year}_*.csv` 模式 |
| PDF 脚本报"未找到可用的中文字体" | 通过 `--font-path` 显式指定一个 .ttf/.ttc；或在系统安装 wqy-zenhei / Noto Sans CJK |
| PDF 中文显示为方块或乱码 | 字体未生效；用 `python -c "from reportlab.pdfbase.ttfonts import TTFont; TTFont('t','/path/to/font.ttf')"` 单独验证字体可加载 |
| `reportlab` ImportError | `pip install reportlab>=4.0.0`，或重新执行 `pip install -r requirements.txt` |

## 文件结构

```
skills/financial_data_collection/
├── SKILL.md                          # 本说明文件
├── requirements.txt                  # Python 依赖
└── scripts/
    ├── collect_financial_data.py     # 脚本一：财务数据采集（akshare → CSV）
    ├── generate_pdf_report.py        # 脚本二：PDF 财务报告生成（CSV → PDF）
    └── akshare_tools.py              # akshare 数据采集工具函数
```

## 扩展指南

### 扩展数据采集（脚本一）

如果需要支持更多市场或更多数据源：

1. 在 `scripts/akshare_tools.py` 中添加新的采集函数
2. 在 `collect_company_financial_data` 函数中添加对应 market 的分支
3. 更新 `SKILL.md` 中的输入参数和输出产物说明

### 扩展 PDF 报告（脚本二）

如果需要定制报告模板：

1. **调整章节顺序 / 内容**：编辑 `scripts/generate_pdf_report.py` 中的 `build_story()` 函数
2. **增加新章节**：如"分季度数据""分业务线收入""非财务披露"等，只需追加一个章节块并 append 到 story
3. **更换视觉风格**：修改 `build_styles()` 中的颜色常量（`#0b5394` 标题色、`#f4f8fc` 卡片背景色）
4. **支持多年度对比**：改造 `build_story()` 接受多年数据，渲染并列表格或趋势图
5. **新增样式**：在 `data_table()` / `kpi_card_table()` 中通过 ReportLab `TableStyle` 添加 `BACKGROUND` / `BOX` 等属性

> 设计原则：保持 LLM（脚本调用方）只负责意图理解，所有确定性的格式化、计算、渲染都交给脚本处理。

## 安全与合规

1. 本 skill 只读取公开披露的财务数据，不进行交易、下单等敏感操作
2. 采集大量数据时保持合理请求间隔，避免对数据源造成压力
3. 不要在脚本中硬编码 API 密钥或敏感信息
4. PDF 报告内容基于公开 CSV 数据自动渲染，不构成投资建议；最终财务披露以公司公告为准
