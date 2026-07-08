#!/usr/bin/env python3
"""render.py — pdf-report skill の確定性レンダラ(O1 技能化)。

winclaw 数字人秘书の `document.generate_pdf` 系タスクを **毎回コードを現写しない**
確定パイプラインへ固定する。LLM は content.json(内容のみ)を作り、本スクリプトが
固定 template.html へ注入 → Chromium(playwright)で PDF 描画する。

使い方:
  python render.py content.json --out "英伟达投资分析报告.pdf"

content.json スキーマ(厳守):
  {
    "title":    "英伟达投资价值分析报告",          # 必須
    "subtitle": "2026Q2 · 生成: 数字人秘书",       # 任意
    "sections": [                                    # 必須(1件以上)
      { "heading": "结论",
        "body":    "…段落テキスト…",               # 任意
        "bullets": ["要点1", "要点2"],              # 任意
        "table":   { "columns": ["项目","值"],       # 任意
                     "rows": [["营收","+22%"], …] } }
    ]
  }

設計:
- 半成品回避(O6): 一時ファイル + os.replace で原子 rename。
- 依存: playwright(chromium は image に事前導入。未導入なら明示 stderr で終了=現写に退行しない)。
- 秘密/外部通信なし。純ローカル描画。
"""
from __future__ import annotations

import argparse
import html
import json
import os
import sys
import tempfile
from typing import Any


def _esc(s: Any) -> str:
    return html.escape(str(s if s is not None else ""))


def _render_table(table: dict) -> str:
    cols = table.get("columns") or []
    rows = table.get("rows") or []
    if not cols and not rows:
        return ""
    thead = "".join(f"<th>{_esc(c)}</th>" for c in cols)
    trs = []
    for r in rows:
        tds = "".join(f"<td>{_esc(c)}</td>" for c in r)
        trs.append(f"<tr>{tds}</tr>")
    return f"<table><thead><tr>{thead}</tr></thead><tbody>{''.join(trs)}</tbody></table>"


def _render_section(sec: dict) -> str:
    parts = []
    heading = sec.get("heading")
    if heading:
        parts.append(f"<h2>{_esc(heading)}</h2>")
    body = sec.get("body")
    if body:
        # 段落を <p> 分割(空行区切り)。
        for para in str(body).split("\n\n"):
            para = para.strip()
            if para:
                parts.append(f"<p>{_esc(para)}</p>")
    bullets = sec.get("bullets")
    if bullets:
        lis = "".join(f"<li>{_esc(b)}</li>" for b in bullets)
        parts.append(f"<ul>{lis}</ul>")
    table = sec.get("table")
    if isinstance(table, dict):
        parts.append(_render_table(table))
    return f"<section>{''.join(parts)}</section>"


def build_html(content: dict, template: str) -> str:
    title = content.get("title") or "レポート"
    subtitle = content.get("subtitle") or ""
    sections = content.get("sections") or []
    if not sections:
        raise ValueError("content.json: 'sections' が空です(1件以上必須)")
    body_html = "".join(_render_section(s) for s in sections if isinstance(s, dict))
    return (
        template
        .replace("{{title}}", _esc(title))
        .replace("{{subtitle}}", _esc(subtitle))
        .replace("{{sections}}", body_html)
    )


def render_pdf(html_str: str, out_path: str) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.stderr.write(
            "[pdf-report] playwright 未導入。image に事前導入が必要(コードを現写しないこと)。\n"
        )
        sys.exit(3)

    # 一時 HTML を書き file:// で開く(外部通信なし)。
    tmp_dir = tempfile.mkdtemp(prefix="pdf-report-")
    tmp_html = os.path.join(tmp_dir, "rendered.html")
    with open(tmp_html, "w", encoding="utf-8") as f:
        f.write(html_str)

    tmp_pdf = out_path + ".part"
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        try:
            page = browser.new_page()
            page.goto(f"file://{tmp_html}", wait_until="networkidle")
            page.pdf(
                path=tmp_pdf,
                format="A4",
                print_background=True,
                margin={"top": "16mm", "bottom": "16mm", "left": "14mm", "right": "14mm"},
            )
        finally:
            browser.close()
    # 原子 rename(半成品回避)。
    os.replace(tmp_pdf, out_path)


def main() -> None:
    ap = argparse.ArgumentParser(description="pdf-report 確定性レンダラ")
    ap.add_argument("content", help="content.json のパス")
    ap.add_argument("--out", required=True, help="出力 PDF パス(例 \"報告.pdf\")")
    ap.add_argument(
        "--template",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "template.html"),
        help="テンプレート HTML(既定=同梱 template.html)",
    )
    args = ap.parse_args()

    with open(args.content, encoding="utf-8") as f:
        content = json.load(f)
    with open(args.template, encoding="utf-8") as f:
        template = f.read()

    html_str = build_html(content, template)
    render_pdf(html_str, args.out)
    print(f"[pdf-report] OK -> {args.out} ({os.path.getsize(args.out)} bytes)")


if __name__ == "__main__":
    main()
