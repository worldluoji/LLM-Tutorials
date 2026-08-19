---
type: source
source_type: {annual_report|research_report|news|announcement}
code: {CODE}
issuer: {ISSUER}
report_date: {YYYY-MM-DD}
period: {YYYY-MM-DD~YYYY-MM-DD}
brokerage: {BROKERAGE_OR_NULL}
rating: {买入|增持|中性|减持|null}
file: raw/{FILENAME}
extracted_entities: []
imported: {TODAY}
---

# {TITLE}

## 报告基本信息

| 字段 | 值 |
|------|----|
| 资料类型 | {annual_report/research_report/news/announcement} |
| 发布方 | {ISSUER} |
| 发布日期 | {YYYY-MM-DD} |
| 报告期间 | {PERIOD} |
| 券商 | {BROKERAGE} |
| 评级 | {RATING} |
| 原始文件 | `data/raw/{FILENAME}` |

## 核心数据

> 从原文提取的关键指标。

| 指标 | 数值 | 同比 | 单位 |
|------|------|------|------|
|  |  |  |  |

## 主要观点

1. **{观点标题}** — {简述}（参考章节：第 X 节）
2. **{观点标题}** — {简述}（参考章节：第 X 节）
3. **{观点标题}** — {简述}（参考章节：第 X 节）

## 关键风险

> 仅当报告本身有风险章节时填写。

1. **{风险}** — {简述}
2. **{风险}** — {简述}

## 提取的实体

### 个股
- [[{CODE}-{NAME}]]

### 行业
- [[industry-{INDUSTRY}]]

### 宏观/概念
- [[macro-{CONCEPT}]]

## 相关概念

- [[macro-{CONCEPT_1}]]
- [[macro-{CONCEPT_2}]]