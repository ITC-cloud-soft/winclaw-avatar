---
name: pdf-report
description: 生成结构化 PDF 报告(投资分析/研究报告/总结等)。任何「生成PDF / 做成PDF报告 / 出个报告」的任务都必须用它,禁止现写渲染代码。
when_to_use: 用户要求生成/整理成 PDF 报告时(document.generate_pdf)。
allowed-tools: Write, Bash
metadata:
  winclaw:
    emoji: "📄"
    requires:
      bins: ["python3", "chromium"]
---

# pdf-report — 确定性 PDF 报告流水线(禁止现写渲染代码)

把「生成 PDF」固化为**确定性流水线**:你只产**内容 JSON**,渲染由固定脚本 `render.py`
完成(模板注入 + Chromium/playwright 渲染)。这样耗时从~10 分降到~1-2 分、无试错版本、无
`pdf.worker` / chromium 现装崩溃。

## 铁律(硬性 · 违反即失败)
- ❌ **禁止**自己写 HTML / playwright / puppeteer 脚本。
- ❌ **禁止** `npm install` / `pip install` / `npx playwright install`(chromium 已随镜像预装)。
- ❌ **禁止**读取参考 PDF(不需要;内容你直接产出)。
- ✅ 你的**唯一交付**是 `content.json`(严格 schema,见下)。
- ✅ 你的**唯一执行动作**是运行 `render.py`。
- 🚦 门禁:`render.py` 成功产出 PDF 前**不结束本回合**;若失败,报告脚本 stderr 原文并停止,**不得改写脚本**。

## 步骤
1. (可选)若需真实资料,先用 `research` / `doc-extract` 提取(勿在本 skill 里读 PDF)。
2. **Write `content.json`**(工作目录下),严格遵守下方 schema。
3. **运行**:
   ```bash
   python3 .claude/skills/pdf-report/render.py content.json --out "<报告标题>.pdf"
   ```
   （`.claude/skills/pdf-report/` 不存在时回退 `skills/pdf-report/`。）
4. 产物 PDF 落在工作目录 → 自动出现在秘书面板「成果物」列表。回合结束前口头确认一句已生成。

## content.json schema(严格)
```jsonc
{
  "title":    "英伟达投资价值分析报告",          // 必须
  "subtitle": "2026 Q2 · 数字人秘书",            // 可选
  "sections": [                                   // 必须(≥1)
    {
      "heading": "结论",                          // 可选
      "body":    "多段落文本,用空行分段。",       // 可选
      "bullets": ["要点一", "要点二"],            // 可选
      "table": {                                   // 可选
        "columns": ["项目", "数值"],
        "rows": [["营收同比", "+22%"], ["毛利率", "75%"]]
      }
    }
  ]
}
```

## 失败处理
- `render.py` 退出码 3 = playwright 未装(镜像问题,报告给用户,**不要**尝试安装)。
- 其它非零 = 打印 stderr,检查 content.json 是否合 schema(常见:sections 空、JSON 语法错)。
