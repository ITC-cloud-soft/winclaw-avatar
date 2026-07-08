---
name: excel-fill
description: 基于模板 xlsx 填写数据(官方帐票/様式表单,如労働者派遣事業報告書·決算書·各类申请表)。任何「按模板填 Excel / 把数据填进这个 xlsx / 生成様式第N号」的任务都必须用它,禁止现写 openpyxl/pandas 代码。
when_to_use: 需要把提取到的数据填入一个已有 Excel 模板(尤其含合并单元格/多 sheet 的官方様式)时。
allowed-tools: Write, Bash
metadata:
  winclaw:
    emoji: "📊"
    requires:
      bins: ["python3"]
---

# excel-fill — 确定性 Excel 填写流水线(禁止现写 openpyxl 代码)

把「按模板填 Excel」固化为**确定性流水线**:你只产 **`spec.json`(哪个 sheet 的哪个格填什么)**,
填写的所有机微(合并单元格→锚点解析、保存、**保存后重新打开校验**、多文件全成功才提交)由固定脚本
`fill.py` 完成。这样根除两个典型事故:
1. 直接给合并单元格的非锚点格赋值 → openpyxl 抛 `MergedCell` 只读异常 → `save()` 没执行 → 成果物是空白样本(脚本会自动把写入重定向到合并区锚点,不会崩)。
2. 「以为填好了」→ 脚本**保存后再打开逐格校验**,不通过就非零退出、不产出半成品文件。

## 铁律(硬性 · 违反即失败)
- ❌ **禁止**自己写 openpyxl / pandas / xlsxwriter 脚本去填 Excel。
- ❌ **禁止** `pip install`(openpyxl 已随镜像预装)。
- ✅ 你的**唯一交付**是 `spec.json`(严格 schema,见下)。
- ✅ 你的**唯一执行动作**是运行 `fill.py`。
- 🚦 **完成门禁(修掉"假完成"的关键)**:只有 `fill.py` **退出码为 0** 时,本任务才算成功——
  才可以写 `task.json`、才可以口头报告完成。**退出码非 0 时:绝对不要写 task.json,不要说已完成**,
  而是把脚本 stderr 原文报告给用户并停下(可按提示修 `spec.json` 后重跑,但**不得改写 `fill.py`**)。

## 步骤
1. **先看模板结构**(每个模板都先看,别猜格子):
   ```bash
   python3 .claude/skills/excel-fill/fill.py inspect --template slots/slot1/002634889.xlsx > /tmp/i11.json
   ```
   （`.claude/skills/excel-fill/` 不存在时回退 `skills/excel-fill/`。）
   输出含每个 sheet 的 `name` / `merged`(合并范围)/ `cells`(非空格的 coord+值=标签)。
   据此判断「标签在哪、值该写进相邻的哪个格」。**合并区内任一格都可指定,脚本自动写到锚点。**
2. （需真实资料时)先用 `doc-extract` 从 slot 资料提取真值,再据此定每个格的值。
3. **Write `spec.json`**,严格按下方 schema。数值填**原始数字**(`22000000`,不要 `"22,000,000"`),
   让模板自带的数字格式去显示;日期/和暦(`令和7年`)等按文本填字符串。
4. **运行**(多样式一次填完,全成功才提交):
   ```bash
   python3 .claude/skills/excel-fill/fill.py fill --spec spec.json
   ```
5. 退出码 0 → 成果物 xlsx 落在指定 `out` 路径 → 自动出现在秘书面板「成果物」。回合结束前确认一句。

## spec.json schema(严格)
多文件形(推荐,用于多个様式一次填):
```jsonc
{
  "files": [
    {
      "template": "slots/slot1/002634889.xlsx",                          // 元模板路径
      "out": "sessions/<sid>/<tid>/様式第11号_アイテシー.xlsx",          // 输出路径(写到本任务的输出目录)
      "cells": [
        { "sheet": "1面", "cell": "E23", "value": "株式会社アイテーシー" },  // sheet+cell+value
        { "sheet": "1面", "cell": "K3",  "value": "派13-317460" },
        { "sheet": "1面", "cell": "P25", "value": 22000000 }               // 数值用原始数字
      ]
    }
    // …様式第12号 / 12号-2 依此追加…
  ]
}
```
单文件形(命令带 `--template`/`--out`,spec 只需 `{"cells":[...]}`,或直接一个 `cells` 数组)。

## 失败处理(按退出码)
- `2` = spec/结构错误(**保存前已中止,不产半成品**):常见 sheet 名不存在、cell 座标写错、cells 为空 → 用 `inspect` 核对后改 spec。
- `3` = 保存后校验不一致:值没真正写进去(常见:值类型不对/指定了错误的格)→ 按 stderr 列出的「期待 vs 实际」修正。
- `4` = openpyxl 未装(镜像问题,报告用户,**不要**尝试安装)。
- 任一非零 → **不写 task.json、不报完成**,把 stderr 交给用户。
