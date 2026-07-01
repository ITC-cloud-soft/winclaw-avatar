/**
 * secretary-panel.ts
 *
 * 数字人秘书 A案 (docs/10 §4.2 右区 3 段) の Lit カスタム要素。
 *  ① 对话/字幕 + 当前任务状态条
 *  ② 资料 Slot 上传(拖拽/点击 → POST /files/slots)
 *  ③ 任务 & 成果物(POST /tasks / GET /tasks / 轮询 GET /tasks/{id} / 下载)
 *
 * 身份桥(docs/10 §14.5): DH URL の ?aimeta=<scoped token>&api=<ai-meta base> を
 * `aimetaToken` / `aimetaApi` で受け取り、ai-meta backend REST を Bearer で直叩き。
 *
 * 見た目(設計稿準拠): ライトテーマ、白カード + 青アクセント + 余白 + 角丸 + 影。
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface SlotFile { filename: string; rel_path: string; size: number; }
interface Slot { id: number; name: string; files: SlotFile[]; }
interface Task { id: number; prompt: string; status: string; slot_id: number | null; github_url?: string | null; }
interface Artifact { id: number; filename: string; rel_path: string; size: number; }

const ACTIVE = new Set(["pending", "running"]);
const POLL_MS = 3000;

@customElement("secretary-panel")
export class SecretaryPanel extends LitElement {
  static styles = css`
    :host {
      --accent: #4f46e5;
      --accent-hover: #4338ca;
      --ink: #0f172a;
      --ink-soft: #475569;
      --muted: #94a3b8;
      --line: #e7e9f2;
      --card: #ffffff;
      --bg: #f6f7fb;
      display: block;
      height: 100%;
      overflow-y: auto;
      padding: 18px 16px 22px;
      box-sizing: border-box;
      background: linear-gradient(180deg, #f6f7fb 0%, #eef1f8 100%);
      color: var(--ink);
      font-size: 13px;
      -webkit-font-smoothing: antialiased;
    }
    :host::-webkit-scrollbar { width: 8px; }
    :host::-webkit-scrollbar-thumb { background: #d3d8e6; border-radius: 8px; }

    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px 14px 15px;
      margin-bottom: 14px;
      box-shadow: 0 1px 2px rgba(16, 24, 40, .04), 0 6px 18px -10px rgba(16, 24, 40, .12);
    }
    .head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .head .ic {
      width: 26px; height: 26px; border-radius: 8px; flex: 0 0 auto;
      display: grid; place-items: center; color: #fff;
    }
    .ic.i1 { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
    .ic.i2 { background: linear-gradient(135deg, #4f46e5, #3b82f6); }
    .ic.i3 { background: linear-gradient(135deg, #0ea5e9, #22d3ee); }
    .head h3 { font-size: 13.5px; font-weight: 650; margin: 0; flex: 1; letter-spacing: .01em; }

    .badge { border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 650; white-space: nowrap; }
    .b-run { background: #fef3c7; color: #92400e; }
    .b-done { background: #dcfce7; color: #166534; }
    .b-err { background: #fee2e2; color: #991b1b; }
    .b-idle { background: #eef2ff; color: #4f46e5; }
    .b-slot { background: #f1f5f9; color: #475569; font-weight: 600; }

    .statusbar {
      min-height: 42px; border-radius: 12px; padding: 9px 12px;
      background: #f8fafc; border: 1px solid var(--line); color: var(--ink-soft);
      line-height: 1.5;
    }

    textarea {
      width: 100%; box-sizing: border-box; resize: none; min-height: 54px;
      border: 1px solid #d7dbe7; border-radius: 12px; padding: 10px 12px; font: inherit;
      color: var(--ink); background: #fbfcfe; transition: border-color .15s, box-shadow .15s;
    }
    textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79, 70, 229, .12); }
    textarea::placeholder { color: var(--muted); }

    .composer-row { display: flex; align-items: center; gap: 8px; margin-top: 9px; }
    .selwrap { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
    select {
      border: 1px solid #d7dbe7; border-radius: 9px; padding: 5px 8px; font: inherit;
      color: var(--ink-soft); background: #fff;
    }
    .grow { flex: 1; }

    button.primary {
      background: var(--accent); color: #fff; border: 0; border-radius: 11px;
      padding: 8px 16px; font-weight: 650; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      box-shadow: 0 6px 16px -8px rgba(79, 70, 229, .7); transition: background .15s, transform .05s;
    }
    button.primary:hover:not(:disabled) { background: var(--accent-hover); }
    button.primary:active:not(:disabled) { transform: translateY(1px); }
    button.primary:disabled { background: #c7cbd8; box-shadow: none; cursor: not-allowed; }
    .mic {
      width: 34px; height: 34px; border-radius: 999px; border: 1px solid #d7dbe7; background: #fff;
      color: var(--muted); display: grid; place-items: center; cursor: default;
    }

    .tasklist { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .taskitem {
      width: 100%; text-align: left; border: 1px solid var(--line); border-radius: 12px;
      background: #fff; padding: 10px 12px; cursor: pointer; display: flex; gap: 9px; align-items: center;
      transition: border-color .15s, background .15s, box-shadow .15s; font: inherit; color: var(--ink);
    }
    .taskitem:hover { border-color: #c7cbf0; box-shadow: 0 4px 14px -8px rgba(79, 70, 229, .35); }
    .taskitem.sel { border-color: var(--accent); background: #f5f4ff; }
    .taskitem .chev { color: var(--muted); flex: 0 0 auto; transition: transform .15s; }
    .taskitem.sel .chev { transform: rotate(90deg); color: var(--accent); }
    .taskitem .p { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; }

    .arts { margin: 8px 0 2px 28px; display: flex; flex-direction: column; gap: 6px; }
    .art {
      display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
      color: var(--accent); text-decoration: none; font-size: 12px; padding: 4px 10px;
      border: 1px solid #e0e2f0; border-radius: 9px; background: #fafaff; cursor: pointer;
    }
    .art:hover { background: #f0f0ff; border-color: #c7cbf0; }
    .gh { color: #0f172a; }

    .drop {
      border: 1.5px dashed #c3cadd; border-radius: 14px; padding: 22px 14px; text-align: center;
      cursor: pointer; background: #fbfcff; color: var(--ink-soft); transition: .15s;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .drop:hover, .drop.over { border-color: var(--accent); background: #f2f2ff; color: var(--accent); }
    .drop .up { width: 30px; height: 30px; color: var(--accent); }

    .slotlist { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
    .slotcard { border: 1px solid var(--line); border-radius: 12px; background: #fff; padding: 11px 12px; }
    .slotcard .top { display: flex; align-items: center; gap: 8px; }
    .slotcard .nm { font-weight: 650; flex: 1; }
    .file { display: flex; gap: 7px; align-items: center; color: var(--ink-soft); font-size: 12px; margin-top: 6px; }

    .muted { color: var(--muted); font-size: 12px; padding: 4px 2px; }
    .err { color: #dc2626; font-size: 12px; margin-top: 8px; background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 9px; padding: 6px 10px; }
    .spin { animation: sp 1s linear infinite; } @keyframes sp { to { transform: rotate(360deg); } }
    .disabled-note { padding: 14px; color: var(--muted); text-align: center; }
  `;

  @property({ type: String }) aimetaToken: string | null = null;
  @property({ type: String }) aimetaApi: string | null = null;
  @property({ type: String }) subtitle: string | null = null;

  @state() private slots: Slot[] = [];
  @state() private tasks: Task[] = [];
  @state() private prompt = "";
  @state() private slotId: number | null = null;
  @state() private submitting = false;
  @state() private uploading = false;
  @state() private over = false;
  @state() private selectedId: number | null = null;
  @state() private detailStatus: string | undefined;
  @state() private artifacts: Artifact[] = [];
  @state() private err: string | null = null;
  private pollTimer: number | null = null;
  private _loaded = false;

  connectedCallback(): void { super.connectedCallback(); this._maybeLoad(); }
  protected updated(): void { this._maybeLoad(); }
  private _maybeLoad(): void {
    if (this.enabled && !this._loaded) {
      this._loaded = true;
      void this.loadSlots();
      void this.loadTasks();
    }
  }
  disconnectedCallback(): void { super.disconnectedCallback(); this.stopPoll(); }

  private get enabled(): boolean { return !!this.aimetaApi && !!this.aimetaToken; }
  private url(path: string): string { return `${this.aimetaApi}/api/v1${path}`; }
  private authHeaders(): Record<string, string> { return { Authorization: `Bearer ${this.aimetaToken}` }; }

  private async loadSlots(): Promise<void> {
    try {
      const r = await fetch(this.url("/files/slots"), { headers: this.authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.slots = (await r.json()) as Slot[];
    } catch (e) { this.err = `资料读取失败: ${String(e)}`; }
  }
  private async loadTasks(): Promise<void> {
    try {
      const r = await fetch(this.url("/tasks"), { headers: this.authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.tasks = (await r.json()) as Task[];
    } catch (e) { this.err = `任务读取失败: ${String(e)}`; }
  }
  private async doUpload(files: File[]): Promise<void> {
    if (!files.length || !this.enabled) return;
    this.uploading = true; this.err = null;
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const r = await fetch(this.url("/files/slots"), { method: "POST", headers: this.authHeaders(), body: fd });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await this.loadSlots();
    } catch (e) { this.err = `上传失败: ${String(e)}`; }
    finally { this.uploading = false; }
  }
  private async submit(e: Event): Promise<void> {
    e.preventDefault();
    const text = this.prompt.trim();
    if (!text || this.submitting || !this.enabled) return;
    this.submitting = true; this.err = null;
    try {
      const r = await fetch(this.url("/tasks"), {
        method: "POST",
        headers: { ...this.authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, slot_id: this.slotId }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const task = (await r.json()) as Task;
      this.prompt = "";
      await this.loadTasks();
      this.select(task.id);
    } catch (e) { this.err = `任务发布失败: ${String(e)}`; }
    finally { this.submitting = false; }
  }
  private select(id: number): void {
    this.stopPoll();
    if (this.selectedId === id) { this.selectedId = null; this.artifacts = []; return; }
    this.selectedId = id; this.artifacts = []; this.detailStatus = undefined;
    void this.pullDetail();
    this.pollTimer = window.setInterval(() => void this.pullDetail(), POLL_MS);
  }
  private stopPoll(): void { if (this.pollTimer != null) { clearInterval(this.pollTimer); this.pollTimer = null; } }
  private async pullDetail(): Promise<void> {
    if (this.selectedId == null) return;
    try {
      const r = await fetch(this.url(`/tasks/${this.selectedId}`), { headers: this.authHeaders() });
      if (r.status === 404) { this.stopPoll(); return; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as { task: Task; artifacts: Artifact[] };
      this.detailStatus = d.task.status;
      this.artifacts = d.artifacts ?? [];
      if (!ACTIVE.has(d.task.status)) { this.stopPoll(); void this.loadTasks(); }
    } catch { /* transient */ }
  }
  private async download(a: Artifact): Promise<void> {
    if (this.selectedId == null) return;
    try {
      const r = await fetch(this.url(`/tasks/${this.selectedId}/artifacts/${a.id}`), { headers: this.authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = u; link.download = a.filename; link.click();
      URL.revokeObjectURL(u);
    } catch (e) { this.err = `下载失败: ${String(e)}`; }
  }

  private badge(s: string | undefined) {
    const cls = s === "done" ? "b-done" : s === "error" ? "b-err"
      : s === "running" || s === "pending" ? "b-run" : "b-idle";
    const txt = s === "done" ? "完成" : s === "error" ? "出错"
      : s === "running" || s === "pending" ? "进行中" : "空闲";
    return html`<span class="badge ${cls}">${txt}</span>`;
  }

  render() {
    if (!this.enabled) {
      return html`<div class="disabled-note">秘书面板未启用<br />（缺少 ai-meta 身份令牌，请从「开始对话」进入）</div>`;
    }
    const sel = this.tasks.find((t) => t.id === this.selectedId) ?? null;
    const headStatus = this.detailStatus ?? sel?.status;
    return html`
      <!-- ① 对话 / 字幕 -->
      <section class="card">
        <div class="head">
          <span class="ic i1">${icChat}</span>
          <h3>对话 / 字幕</h3>
          ${this.badge(headStatus)}
        </div>
        <div class="statusbar">${this.subtitle || "对话与实时字幕将显示在这里"}</div>
      </section>

      <!-- ② 任务 & 成果物 -->
      <section class="card">
        <div class="head"><span class="ic i2">${icTask}</span><h3>任务 &amp; 成果物</h3></div>
        <form @submit=${(e: Event) => this.submit(e)}>
          <textarea rows="2" .value=${this.prompt}
            placeholder="用文字下达任务,例如:用 slot1 的资料做一份对账分析报告"
            @input=${(e: Event) => (this.prompt = (e.target as HTMLTextAreaElement).value)}></textarea>
          <div class="composer-row">
            <span class="selwrap">关联资料
              <select @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; this.slotId = v === "" ? null : Number(v); }}>
                <option value="">不关联</option>
                ${this.slots.map((s) => html`<option value=${s.id}>${s.name}</option>`)}
              </select>
            </span>
            <span class="grow"></span>
            <span class="mic" title="语音下达（即将开放）">${icMic}</span>
            <button class="primary" type="submit" ?disabled=${this.submitting || !this.prompt.trim()}>
              ${this.submitting ? html`<span class="spin">${icSpin}</span>发布中` : html`${icSend}发布`}
            </button>
          </div>
        </form>
        ${this.err ? html`<p class="err">${this.err}</p>` : nothing}
        ${this.tasks.length === 0
          ? html`<p class="muted">还没有任务</p>`
          : html`<ul class="tasklist">${this.tasks.map((task) => {
              const active = task.id === this.selectedId;
              const st = active && this.detailStatus ? this.detailStatus : task.status;
              const slotName = task.slot_id != null ? this.slots.find((s) => s.id === task.slot_id)?.name : null;
              return html`<li>
                <button class="taskitem ${active ? "sel" : ""}" @click=${() => this.select(task.id)}>
                  <span class="chev">${icChevron}</span>
                  <span class="p">${task.prompt}</span>
                  ${slotName ? html`<span class="badge b-slot">${slotName}</span>` : nothing}
                  ${this.badge(st)}
                </button>
                ${active ? html`<div class="arts">
                  ${task.github_url ? html`<a class="art gh" href=${task.github_url} target="_blank" rel="noopener">${icGit} GitHub</a>` : nothing}
                  ${this.artifacts.length === 0
                    ? html`<span class="muted">${ACTIVE.has(st) ? "进行中,成果物生成后显示…" : "暂无成果物"}</span>`
                    : this.artifacts.map((a) => html`<a class="art" @click=${(e: Event) => { e.preventDefault(); void this.download(a); }}>${icDl} ${a.filename}</a>`)}
                </div>` : nothing}
              </li>`;
            })}</ul>`}
      </section>

      <!-- ③ 资料 Slot -->
      <section class="card">
        <div class="head"><span class="ic i3">${icFolder}</span><h3>资料 Slot</h3></div>
        <div class="drop ${this.over ? "over" : ""}"
          @click=${() => (this.renderRoot.querySelector("#fpick") as HTMLInputElement)?.click()}
          @dragover=${(e: DragEvent) => { e.preventDefault(); this.over = true; }}
          @dragleave=${() => (this.over = false)}
          @drop=${(e: DragEvent) => { e.preventDefault(); this.over = false; void this.doUpload(e.dataTransfer ? Array.from(e.dataTransfer.files) : []); }}>
          <span class="up">${this.uploading ? html`<span class="spin">${icSpin}</span>` : icUpload}</span>
          <span>${this.uploading ? "上传中…" : "拖拽文件到此,或点击上传"}</span>
        </div>
        <input id="fpick" type="file" multiple style="display:none"
          @change=${(e: Event) => { const inp = e.target as HTMLInputElement; void this.doUpload(inp.files ? Array.from(inp.files) : []); inp.value = ""; }} />
        ${this.slots.length === 0
          ? html`<p class="muted">还没有上传资料</p>`
          : html`<ul class="slotlist">${this.slots.map((s) => html`<li class="slotcard">
              <div class="top"><span class="nm">${s.name}</span><span class="muted">${s.files.length} 文件</span></div>
              ${s.files.map((f) => html`<div class="file">${icFile} ${f.filename}</div>`)}
            </li>`)}</ul>`}
      </section>
    `;
  }
}

// ── inline SVG icons (stroke=currentColor) ───────────────────────────────────
const svg = (inner: unknown, w = 15) => html`<svg viewBox="0 0 24 24" width=${w} height=${w} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const icChat = svg(html`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`, 15);
const icTask = svg(html`<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`, 15);
const icFolder = svg(html`<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`, 15);
const icMic = svg(html`<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>`, 16);
const icSend = svg(html`<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`, 15);
const icSpin = svg(html`<path d="M21 12a9 9 0 1 1-6.219-8.56"/>`, 15);
const icChevron = svg(html`<polyline points="9 18 15 12 9 6"/>`, 15);
const icUpload = svg(html`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`, 26);
const icFile = svg(html`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`, 14);
const icDl = svg(html`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`, 14);
const icGit = svg(html`<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>`, 14);

declare global {
  interface HTMLElementTagNameMap { "secretary-panel": SecretaryPanel; }
}
