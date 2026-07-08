---
name: doc-extract
description: 把 PDF/PPTX/Word/Excel/图片等二进制文档转成纯文本，让模型能真正阅读。图片走 AI 视觉 OCR 提取其中文字/表格/图表信息。任何涉及读取/研究/分析/总结文档的任务都用它。
metadata:
  winclaw:
    emoji: "📄"
    requires:
      bins: ["python"]
---

# doc-extract — 统一文档读取（PDF / PPTX / Word / Excel / 图片 → 文本）

**你拥有完整文件访问权（bypassPermissions）。任何本地文件都能读，禁止声称「权限问题」「无法访问」——那是错误的。**

二进制文档（.pdf .pptx .docx .xlsx .jpg .png）不能直接当文本 `Read`，必须先用本 skill 转成文本。脚本通过 skill 挂载在**工作目录下**，用**相对路径 + 正斜杠**调用（不要写反斜杠绝对路径，bash 里 `\w \s` 会被转义）：

## 用法（路径一律用正斜杠 `/`）
- **单个文件 → 文本（stdout，随后 Read 输出）**
  ```bash
  python .claude/skills/doc-extract/extract.py "<文件路径，用正斜杠>"
  ```
- **整个目录一次提取（做研究/分析时推荐）→ 汇总成 SOURCE.md**
  ```bash
  python .claude/skills/doc-extract/extract.py --batch "<目录>" --out "<目录>/SOURCE.md"
  ```
  然后 `Read` 该 `SOURCE.md` —— 一次拿到目录内所有 PDF/PPTX/Word/Excel/**图片**/markdown/js 的全文。
  脚本已自动**去重**(同名 pdf/pptx 只取一个)+ **每文件上限**(`--max-chars`,默认 6000),把 SOURCE.md 控制在可处理大小。
  **图片默认包含**(走 AI 视觉 OCR);只读文本不要图片时加 `--no-ocr`。

## 支持与依赖
- PDF / PPTX / DOCX / XLSX：**开箱即用**（PyMuPDF·pdfplumber·python-pptx·python-docx·openpyxl 已装）。
- **图片（.jpg/.png）→ AI 视觉 OCR**：默认用视觉大模型(OpenAI 兼容 `/chat/completions` + image_url)提取图片中的**文字、数字、表格、图表、流程图、标注**等全部信息（适合幻灯片渲染图、扫描件、图表）。
  - 配置(环境变量,有默认值,通常无需设置)：`DOC_EXTRACT_VISION_KEY`(密钥;缺省回退 `DASHSCOPE_API_KEY` → winclaw.json 里 digital-human 的 qwen key → `ANTHROPIC_AUTH_TOKEN`)、`DOC_EXTRACT_VISION_BASE_URL`(缺省 DashScope compatible-mode,由 `WINCLAW_DH_DASHSCOPE_HOST` 推导)、`DOC_EXTRACT_VISION_MODEL`(缺省 `qwen-vl-max`)。
  - AI OCR 失败时自动回退本地 `tesseract`(若已装)；都不可用则对**该张图片**输出明确提示并继续，**绝不整体崩溃**。
- 视频/二进制无文本者自动跳过。

## 何时使用（when to use）
阅读、研究、分析、总结、或「根据某目录的资料开发/编写」任何 PDF/PPTX/DOCX/XLSX/**图片**、或一个含混合文档的目录时——**先用本 skill 提取真实文本，再产出**。不要凭一般知识硬编，不要说「读不了/权限问题」。
