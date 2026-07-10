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
 * 見た目(Sprint D §4.4 視覚統一 / 視覚正本 = ai-meta chat.html 右栏):
 *   暗色テーマ。ink 系ダークカード + brand ウォームグラデ小方块图标 + tx/tx-mut 文字。
 *   状態/成果物 badge は暗底 + 安全色(在线绿/金/薰衣草)。brand token 值は
 *   ai-meta §3.4 と精確一致(pink/coral/lav/grad-warm/ink/line/gold/live)。
 *   ※品牌色を変える時は ai-meta(tailwind)側と両方同期(docs 方案 §7-10)。
 */
import { LitElement, html, css, nothing, svg as svgIcon } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t, subscribeLocale } from "../../i18n";
import "./music-player.js";
import type { MusicTrackView } from "./music-player.js";

interface SlotFile { id: number; filename: string; rel_path: string; size: number; mime?: string | null; }
interface Slot { id: number; name: string; files: SlotFile[]; }
interface Task { id: number; user_seq?: number | null; name?: string | null; prompt: string; status: string; slot_id: number | null; github_url?: string | null; }
interface Artifact { id: number; filename: string; rel_path: string; size: number; }

const ACTIVE = new Set(["pending", "running"]);
const POLL_MS = 3000;
// 選択タスクの有無に関わらず、任務一覧 + 成果物(ノードファイル)を定期更新する。
// これが無いと成果物リストはマウント時1回+手動更新のみ = 非同期タスク完了後に
// PDF 等が出るのに気づけない(ユーザ要望: 成果物生成後に画面自動更新)。
const REFRESH_MS = 5000;

@customElement("secretary-panel")
export class SecretaryPanel extends LitElement {
  static styles = css`
    :host {
      /* ── brand token(ai-meta §3.4 复刻・值精确一致)────────────────────── */
      --brand-pink: #F0759B;
      --brand-coral: #FF8A65;
      --brand-lav: #8B78D6;
      --grad-warm: linear-gradient(135deg, #FF8A65, #F0759B 55%, #8B78D6);
      --ink: #0F0B15;
      --ink-2: #171120;
      --ink-3: #20182E;
      --ink-line: #332741;
      --gold: #C9962E;
      --live: #7CFFC0;
      --tx: #F6F1FB;
      --tx-mut: #B7AAC9;
      --r: 14px;
      /* 別名(既存クラスからの参照互換) */
      --accent: var(--brand-pink);
      --line: var(--ink-line);
      --muted: var(--tx-mut);
      display: block;
      height: 100%;
      overflow-y: auto;
      padding: 18px 16px 22px;
      box-sizing: border-box;
      background: radial-gradient(120% 60% at 50% -8%, rgba(247, 168, 196, .10), transparent 60%), var(--ink);
      color: var(--tx);
      font-size: 13px;
      font-family: "Inter", "Noto Sans SC", system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    :host::-webkit-scrollbar { width: 8px; }
    :host::-webkit-scrollbar-thumb { background: var(--ink-line); border-radius: 8px; }

    .card {
      background: var(--ink-2);
      border: 1px solid var(--ink-line);
      border-radius: var(--r);
      padding: 14px 14px 15px;
      margin-bottom: 14px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 10px 26px -14px rgba(0, 0, 0, .6);
    }
    .head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .head .ic {
      width: 26px; height: 26px; border-radius: 8px; flex: 0 0 auto;
      display: grid; place-items: center; color: #1a0f12;
      background: var(--grad-warm);
    }
    /* 3 段とも brand ウォームグラデ小方块(chat.html 右栏に統一) */
    .ic.i1, .ic.i2, .ic.i3 { background: var(--grad-warm); }
    .head h3 { font-size: 13.5px; font-weight: 650; margin: 0; flex: 1; letter-spacing: .01em; color: var(--tx);
      font-family: "Poppins", "Inter", "Noto Sans SC", sans-serif; }

    .badge { border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 650; white-space: nowrap; border: 1px solid transparent; }
    /* 暗底 + 安全色 */
    .b-run { background: rgba(201, 150, 46, .16); color: var(--gold); border-color: rgba(201, 150, 46, .4); }
    .b-done { background: rgba(124, 255, 192, .12); color: var(--live); border-color: rgba(124, 255, 192, .35); }
    .b-err { background: rgba(240, 117, 155, .16); color: #FF9DBB; border-color: rgba(240, 117, 155, .4); }
    .b-idle { background: rgba(139, 120, 214, .16); color: #C3B7F2; border-color: rgba(139, 120, 214, .4); }
    .b-slot { background: var(--ink-3); color: var(--tx-mut); font-weight: 600; border-color: var(--ink-line); }

    .statusbar {
      min-height: 42px; border-radius: 12px; padding: 9px 12px;
      background: var(--ink-3); border: 1px solid var(--ink-line); color: var(--tx-mut);
      line-height: 1.5;
    }

    textarea {
      width: 100%; box-sizing: border-box; resize: none; min-height: 54px;
      border: 1px solid var(--ink-line); border-radius: 12px; padding: 10px 12px; font: inherit;
      color: var(--tx); background: var(--ink-3); transition: border-color .15s, box-shadow .15s;
    }
    textarea:focus { outline: none; border-color: var(--brand-pink); box-shadow: 0 0 0 3px rgba(240, 117, 155, .18); }
    textarea::placeholder { color: var(--tx-mut); opacity: .8; }

    .composer-row { display: flex; align-items: center; gap: 8px; margin-top: 9px; }
    .selwrap { display: inline-flex; align-items: center; gap: 6px; color: var(--tx-mut); font-size: 12px; }
    select {
      border: 1px solid var(--ink-line); border-radius: 9px; padding: 5px 8px; font: inherit;
      color: var(--tx); background: var(--ink-3);
    }
    .grow { flex: 1; }

    button.primary {
      background: var(--grad-warm); color: #1a0f12; border: 0; border-radius: 11px;
      padding: 8px 16px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
      box-shadow: 0 8px 20px -8px rgba(240, 117, 155, .6); transition: filter .15s, transform .05s;
    }
    button.primary:hover:not(:disabled) { filter: brightness(1.06); }
    button.primary:active:not(:disabled) { transform: translateY(1px); }
    button.primary:disabled { background: var(--ink-3); color: var(--tx-mut); box-shadow: none; cursor: not-allowed; }
    .mic {
      width: 34px; height: 34px; border-radius: 999px; border: 1px solid var(--ink-line); background: var(--ink-3);
      color: var(--tx-mut); display: grid; place-items: center; cursor: default;
    }

    .tasklist { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .taskitem {
      width: 100%; text-align: left; border: 1px solid var(--ink-line); border-radius: 12px;
      background: var(--ink-3); padding: 10px 12px; cursor: pointer; display: flex; gap: 9px; align-items: center;
      transition: border-color .15s, background .15s, box-shadow .15s; font: inherit; color: var(--tx);
    }
    .taskitem:hover { border-color: rgba(240, 117, 155, .45); box-shadow: 0 4px 14px -8px rgba(240, 117, 155, .4); }
    .taskitem.sel { border-color: var(--brand-pink); background: rgba(240, 117, 155, .08); }
    .taskitem .chev { color: var(--tx-mut); flex: 0 0 auto; transition: transform .15s; }
    .taskitem.sel .chev { transform: rotate(90deg); color: var(--brand-pink); }
    .taskitem .p { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; }

    .arts { margin: 8px 0 2px 28px; display: flex; flex-direction: column; gap: 6px; }
    .art {
      display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
      color: var(--tx); text-decoration: none; font-size: 12px; padding: 4px 10px;
      border: 1px solid var(--ink-line); border-radius: 9px; background: var(--ink-3); cursor: pointer;
    }
    .art:hover { background: rgba(240, 117, 155, .1); border-color: rgba(240, 117, 155, .45); }
    .gh { color: var(--tx); }

    .drop {
      border: 1.5px dashed var(--ink-line); border-radius: var(--r); padding: 22px 14px; text-align: center;
      cursor: pointer; background: var(--ink-3); color: var(--tx-mut); transition: .15s;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .drop:hover, .drop.over { border-color: var(--brand-pink); background: rgba(240, 117, 155, .08); color: var(--brand-pink); }
    .drop .up { width: 30px; height: 30px; color: var(--brand-pink); }

    .slotlist { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
    .slotcard { border: 1px solid var(--ink-line); border-radius: 12px; background: var(--ink-3); padding: 11px 12px; }
    .slotcard .top { display: flex; align-items: center; gap: 8px; }
    .slotcard .nm { font-weight: 650; flex: 1; color: var(--tx); }
    .file { display: flex; gap: 7px; align-items: center; color: var(--tx-mut); font-size: 12px; margin-top: 6px; }

    .muted { color: var(--tx-mut); font-size: 12px; padding: 4px 2px; }
    .err { color: #FF9DBB; font-size: 12px; margin-top: 8px; background: rgba(240, 117, 155, .12); border: 1px solid rgba(240, 117, 155, .4);
      border-radius: 9px; padding: 6px 10px; }
    .spin { animation: sp 1s linear infinite; } @keyframes sp { to { transform: rotate(360deg); } }
    .disabled-note { padding: 14px; color: var(--tx-mut); text-align: center; }

    /* 成果物: プレビュー可能なチップ(名前=preview、DLアイコン=download) */
    .art { cursor: pointer; }
    .art-nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .art-dl { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px;
      color: var(--tx); flex: 0 0 auto; }
    .art-dl:hover { background: var(--ink-line); color: var(--brand-pink); }

    /* preview モーダル(暗壳。html iframe / 白底 PDF は内側で白のまま=枠で分離) */
    .pv-mask { position: fixed; inset: 0; background: rgba(6, 4, 10, .72); display: grid; place-items: center; z-index: 9999; }
    .pv-box { width: min(92vw, 940px); height: min(86vh, 760px); background: var(--ink-2); border-radius: 16px;
      display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--ink-line);
      box-shadow: 0 24px 70px -12px rgba(0, 0, 0, .7); }
    .pv-head { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-bottom: 1px solid var(--ink-line); }
    .pv-name { flex: 1; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--tx); }
    .pv-dl { background: var(--grad-warm); color: #1a0f12; border: 0; border-radius: 9px; padding: 6px 13px; cursor: pointer;
      display: inline-flex; align-items: center; gap: 5px; font: inherit; font-weight: 700; }
    .pv-dl:hover { filter: brightness(1.06); }
    .pv-x { background: var(--ink-3); border: 1px solid var(--ink-line); border-radius: 8px; width: 30px; height: 30px; cursor: pointer; font-size: 14px; color: var(--tx-mut); }
    .pv-x:hover { background: var(--ink-line); color: var(--tx); }
    .pv-body { flex: 1; overflow: auto; background: var(--ink); }
    /* html/pdf は白底コンテンツ → 枠+角丸で暗壳から分離 */
    .pv-frame { width: 100%; height: 100%; border: 0; background: #fff; }
    .pv-pre { margin: 0; padding: 14px; white-space: pre-wrap; word-break: break-word; font-size: 12.5px; line-height: 1.5; color: var(--tx); }
    .pv-img { max-width: 100%; display: block; margin: 12px auto; }
    .pv-none { padding: 44px 20px; text-align: center; color: var(--tx-mut); }

    /* 生成的成果物(node 実ファイル)一覧 */
    .nf-head { display: flex; align-items: center; gap: 8px; margin: 14px 0 6px; padding-top: 12px; border-top: 1px dashed var(--ink-line); }
    .nf-title { font-size: 12px; font-weight: 650; color: var(--tx-mut); flex: 1; }
    .nf-refresh { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; color: var(--tx-mut); cursor: pointer; }
    .nf-refresh:hover { background: var(--ink-line); color: var(--brand-pink); }
    .nf-list { margin: 0; }

    /* ── 任务编号 #N + name(タスク管理画面と統一)── */
    .taskitem .seq { flex: 0 0 auto; font-weight: 800; font-size: 12.5px; color: var(--tx-mut); font-variant-numeric: tabular-nums; }
    .taskitem.sel .seq { color: var(--brand-pink); }

    /* ── 継続指示コンポーザ(選択タスク配下)── */
    .cont { margin: 8px 0 2px 28px; display: flex; flex-direction: column; gap: 7px; }
    .cont textarea { min-height: 40px; font-size: 12.5px; }
    .cont .row { display: flex; justify-content: flex-end; }
    .cont button { padding: 6px 14px; font-size: 12.5px; }

    /* ── slot ヘッダのアクション(追加 / 削除 / lock)+ ファイル行の削除 ── */
    /* 暗底で見える様に:白アイコン + 明るめの箱(--ink-line 背景 + 明線)。 */
    .slotcard .act { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 8px;
      border: 1px solid #4a3a5e; background: var(--ink-line); color: var(--tx); cursor: pointer; flex: 0 0 auto; }
    .slotcard .act:hover { border-color: var(--brand-pink); background: rgba(240, 117, 155, .16); color: #fff; }
    .slotcard .act.del:hover { border-color: #FF9DBB; background: rgba(240, 117, 155, .16); color: #FF9DBB; }
    .slotcard .act.lock { cursor: not-allowed; background: var(--ink-2); color: var(--tx-mut); }
    .slotcard .act:disabled { opacity: .4; cursor: not-allowed; }
    .file { justify-content: flex-start; }
    .file .fn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* ファイル削除は常時表示(hover 依存を廃止)+ 暗底で見える白アイコン + 箱。 */
    .file .fdel { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 7px;
      border: 1px solid #4a3a5e; background: var(--ink-line); color: var(--tx); cursor: pointer; flex: 0 0 auto; }
    .file .fdel:hover { border-color: #FF9DBB; background: rgba(240, 117, 155, .16); color: #FF9DBB; }
    .lockhint { display: flex; align-items: center; gap: 5px; margin-top: 8px; font-size: 11px; color: var(--tx-mut); }

    /* ── 上传来源ボタン(相册 / 拍照。拖拽エリア下)── */
    .src-row { display: flex; gap: 8px; margin-top: 9px; }
    .src-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      border: 1px solid #4a3a5e; border-radius: 10px; background: var(--ink-line); color: var(--tx);
      padding: 9px 10px; font: inherit; font-size: 12px; cursor: pointer; transition: .15s; }
    .src-btn:hover { border-color: var(--brand-pink); background: rgba(240, 117, 155, .16); color: #fff; }
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
  @state() private preview: { name: string; kind: "html" | "pdf" | "image" | "text" | "none"; text?: string; url?: string; art?: Artifact; nodePath?: string } | null = null;
  @state() private nodeFiles: Array<{ name: string; path: string; size: number }> = [];
  // 選択タスクへの継続指示(POST /tasks/{id}/messages)。
  @state() private contMsg = "";
  @state() private contBusy = false;
  // slot 生命周期操作中(追加/削除/文件削除)。二度押し防止。
  @state() private slotBusy = false;
  // 実際の DELETE で 409(slot_in_use)を受けた slot は即座に lock 表示へ倒す。
  @state() private runtimeLocked = new Set<number>();
  // slot へ追加アップロードの対象(hidden input を共用)。
  private addTargetSlot: number | null = null;
  private _composing = false;
  private _unsubLocale: (() => void) | null = null;
  private pollTimer: number | null = null;
  private refreshTimer: number | null = null;
  // ★成果物の自動紐付け(2026-07-10): 前回リフレッシュ時の各タスク status。運行中/完成直後の
  //   タスクへ GET /tasks/{id} を自動発火し backend の B 兜底(成果物 pull)を起こす為。
  private _lastStatuses = new Map<number, string>();
  // 既知の成果物ファイル名 — 新規出現を検知して数字人の音声通知トリガに使う。
  private _knownNodeFiles = new Set<string>();
  private _loaded = false;
  // A案(docs/10 §14.5): 数字人が音声で受けた task_run を dh-websocket が
  // window CustomEvent "secretary-voice-task" で流す。それを ai-meta /tasks/ingest
  // へ記録し、音声タスクも一覧に出す。callId で冪等(二重記録しない)。
  private _voiceTaskListener = (e: Event): void => { void this._onVoiceTask(e as CustomEvent); };
  private _ingestedCallIds = new Set<string>();
  // 音乐カード状態(内蔵 music bundle)。_music=再生対象 / _musicPaused=一時停止。
  @state() private _music: MusicTrackView | null = null;
  @state() private _musicPaused = false;
  // Sprint D §4.3: ui_action(artifact,show,name) の解耦入口。dh-websocket が
  // 'dh-ui-artifact' (detail.name) を発火 → 名前で成果物 popup を開く。
  private _uiArtifactListener = (e: Event): void => {
    const name = (e as CustomEvent).detail?.name;
    // name 有り=その名前で開く / name 空=最新を開く(方案 §7-2)。
    void this.openPreviewNodeByName(typeof name === "string" ? name.trim() : "");
  };
  // Sprint D §4.3: ui_action(artifact, hide/close) の解耦入口。プレビュー popup を閉じる。
  private _uiArtifactCloseListener = (): void => { this.closePreview(); };
  // 語音 ui_action(task_continue): 特定タスク番号(user_seq)へ継続指示を送る。
  // detail.payload = JSON {seq, text}。app-render が dh-ui-task-continue で発火。
  private _taskContinueListener = (e: Event): void => {
    void this._onVoiceTaskContinue(e as CustomEvent);
  };
  // 語音 ui_action(task_artifact): 特定タスク番号の成果物を開く。
  // detail.payload = JSON {seq, query}。app-render が dh-ui-task-artifact で発火。
  private _taskArtifactListener = (e: Event): void => {
    void this._onVoiceTaskArtifact(e as CustomEvent);
  };
  // 語音点歌(内蔵 music bundle・docs/20): detail={action, payload}。
  // action=play(payload=JSON track)/pause/stop。音乐カードの <dh-music-player> を駆動。
  private _uiMusicListener = (e: Event): void => { this._onUiMusic(e as CustomEvent); };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("secretary-voice-task", this._voiceTaskListener);
    window.addEventListener("dh-ui-artifact", this._uiArtifactListener);
    window.addEventListener("dh-ui-artifact-close", this._uiArtifactCloseListener);
    window.addEventListener("dh-ui-task-continue", this._taskContinueListener);
    window.addEventListener("dh-ui-task-artifact", this._taskArtifactListener);
    window.addEventListener("dh-ui-music", this._uiMusicListener);
    // 母画面(ai-meta)の言語切替(URL ?lang → setLocale)に追従して再描画。
    this._unsubLocale = subscribeLocale(() => this.requestUpdate());
    this._maybeLoad();
  }
  protected updated(): void { this._maybeLoad(); }
  private _maybeLoad(): void {
    if (this.enabled && !this._loaded) {
      this._loaded = true;
      void this.loadSlots();
      void this.loadTasks();
      void this.loadNodeFiles();
      this.startRefresh();
    }
  }
  /** 任務一覧 + 成果物を継続的に自動更新(非同期タスク完了を画面へ即反映)。 */
  private startRefresh(): void {
    if (this.refreshTimer != null) return;
    this.refreshTimer = window.setInterval(() => {
      void this.loadTasks().then(() => this._autoLinkArtifacts());
      void this.loadNodeFiles();
    }, REFRESH_MS);
  }

  /**
   * ★成果物の自動紐付け(2026-07-10・ユーザ要件): 完成を宣言したのに成果物が出ない問題の
   * 根治。backend の B 兜底(node の outputs/sessions を pull し Artifact 化)は **GET /tasks/{id}**
   * でしか走らないが、従来は**選択タスクの pollTimer のみ**が叩いていた為、開いていないタスクは
   * 完成後も紐付かず「刷新するまで空」だった。ここで自動リフレッシュ毎に **運行中 or 完成直後**
   * (前回から status が変化)のタスクへ GET を撃ち、成果物を自動で引き込む(手動刷新不要)。
   * 過負荷防止に最新 5 件まで。選択中タスクなら artifacts も即反映。
   */
  private async _autoLinkArtifacts(): Promise<void> {
    if (!this.enabled) return;
    const prev = this._lastStatuses;
    const next = new Map<number, string>();
    const toPull: number[] = [];
    for (const tk of this.tasks) {
      next.set(tk.id, tk.status);
      // 運行中、または 前回と status が変わった(完成直後含む)タスク。
      if (ACTIVE.has(tk.status) || tk.status !== prev.get(tk.id)) toPull.push(tk.id);
    }
    this._lastStatuses = next;
    // 過負荷防止: 直近 5 件のみ(tasks は新しい順)。
    for (const id of toPull.slice(0, 5)) {
      try {
        const r = await fetch(this.url(`/tasks/${id}`), { headers: this.authHeaders() });
        if (!r.ok) continue;
        // 選択中タスクなら成果物一覧も即更新(pullDetail と同旨)。
        if (id === this.selectedId) {
          const d = (await r.json()) as { task: Task; artifacts: Artifact[] };
          this.detailStatus = d.task.status;
          this.artifacts = d.artifacts ?? [];
        }
      } catch { /* transient */ }
    }
  }
  private stopRefresh(): void {
    if (this.refreshTimer != null) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("secretary-voice-task", this._voiceTaskListener);
    window.removeEventListener("dh-ui-artifact", this._uiArtifactListener);
    window.removeEventListener("dh-ui-artifact-close", this._uiArtifactCloseListener);
    window.removeEventListener("dh-ui-task-continue", this._taskContinueListener);
    window.removeEventListener("dh-ui-task-artifact", this._taskArtifactListener);
    window.removeEventListener("dh-ui-music", this._uiMusicListener);
    this._unsubLocale?.();
    this._unsubLocale = null;
    this.stopPoll();
    this.stopRefresh();
  }

  /** 音声委託タスク(task_run)を ai-meta へ記録専用で取り込む(A案)。 */
  private async _onVoiceTask(e: CustomEvent): Promise<void> {
    if (!this.enabled) return;
    const detail = (e.detail ?? {}) as { callId?: string; args?: string };
    const callId = detail.callId || "";
    if (callId && this._ingestedCallIds.has(callId)) return; // 冪等(同一 function_call)
    let taskName = "";
    let path = "";
    let content: string | undefined;
    let filename: string | undefined;
    try {
      const parsed = JSON.parse(detail.args || "{}") as { taskName?: string; args?: Record<string, unknown> };
      taskName = (parsed.taskName || "").trim();
      const a = (parsed.args && typeof parsed.args === "object" ? parsed.args : {}) as Record<string, unknown>;
      path = String(a.destination ?? a.filename ?? a.output ?? a.path ?? a.source ?? "").trim();
      // 成果物ダウンロード: file.write の中身とファイル名を拾い ai-meta に保存させる。
      if (typeof a.content === "string") content = a.content;
      const fn = a.filename ?? a.destination ?? a.path;
      if (typeof fn === "string") filename = fn.replace(/\\/g, "/").split("/").pop() || undefined;
    } catch { /* args 解析失敗は無視 */ }
    if (!taskName) return;
    if (callId) this._ingestedCallIds.add(callId);
    const prompt = `🎙 语音任务: ${taskName}${path ? ` → ${path}` : ""}`;
    try {
      const r = await fetch(this.url("/tasks/ingest"), {
        method: "POST",
        headers: { ...this.authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          status: "done",
          task_id_str: callId || undefined,
          output_rel: path || undefined,
          content,
          filename,
        }),
      });
      if (r.ok) await this.loadTasks();
    } catch { /* best-effort */ }
  }

  /** 語音点歌 dh-ui-music を音乐カードへ反映(play=新曲・pause=一時停止・stop=消去)。 */
  private _onUiMusic(e: CustomEvent): void {
    const detail = (e.detail ?? {}) as { action?: string; payload?: string };
    const action = detail.action || "play";
    if (action === "stop") {
      this._music = null;
      this._musicPaused = false;
      return;
    }
    if (action === "pause") {
      this._musicPaused = true;
      return;
    }
    if (action === "resume") {
      this._musicPaused = false;
      return;
    }
    // play: payload = JSON {playUrl,title,artist,cover,loop,source}
    try {
      const tr = JSON.parse(detail.payload || "{}") as MusicTrackView & { cover?: string };
      if (!tr.playUrl) return;
      this._music = {
        playUrl: tr.playUrl,
        title: tr.title || "未知曲目",
        artist: tr.artist || "",
        cover: tr.cover || undefined,
        loop: tr.loop !== false,
        source: tr.source,
      };
      this._musicPaused = false;
    } catch { /* payload 解析失敗は無視 */ }
  }

  private get enabled(): boolean { return !!this.aimetaApi && !!this.aimetaToken; }
  private url(path: string): string { return `${this.aimetaApi}/api/v1${path}`; }
  private authHeaders(): Record<string, string> { return { Authorization: `Bearer ${this.aimetaToken}` }; }

  private async loadSlots(): Promise<void> {
    try {
      const r = await fetch(this.url("/files/slots"), { headers: this.authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.slots = (await r.json()) as Slot[];
    } catch (e) { this.err = `${t("secretary.errLoadSlots")}: ${String(e)}`; }
  }
  private async loadTasks(): Promise<void> {
    try {
      const r = await fetch(this.url("/tasks"), { headers: this.authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.tasks = (await r.json()) as Task[];
    } catch (e) { this.err = `${t("secretary.errLoadTasks")}: ${String(e)}`; }
  }
  /** 新規 slot 作成アップロード(拖拽 / 相册 / 拍照)。 */
  private async doUpload(files: File[]): Promise<void> {
    if (!files.length || !this.enabled) return;
    this.uploading = true; this.err = null;
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const r = await fetch(this.url("/files/slots"), { method: "POST", headers: this.authHeaders(), body: fd });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await this.loadSlots();
    } catch (e) { this.err = `${t("secretary.errUpload")}: ${String(e)}`; }
    finally { this.uploading = false; }
  }

  // ── slot 生命周期(タスク管理画面と同等: 追加ファイル / slot 削除(使用中は不可) / ファイル削除)──
  /** 使用中(タスクが slot_id 参照)の slot は削除不可。tasks + runtime 409 で判定。 */
  private slotLocked(slotId: number): boolean {
    if (this.runtimeLocked.has(slotId)) return true;
    return this.tasks.some((tk) => tk.slot_id === slotId);
  }
  /** 既存 slot へファイル追加(POST /files/slots/{id}/files)。 */
  private async addToSlot(slotId: number, files: File[]): Promise<void> {
    if (!files.length || !this.enabled) return;
    this.slotBusy = true; this.err = null;
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const r = await fetch(this.url(`/files/slots/${slotId}/files`), { method: "POST", headers: this.authHeaders(), body: fd });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await this.loadSlots();
    } catch (e) { this.err = `${t("secretary.errUpload")}: ${String(e)}`; }
    finally { this.slotBusy = false; }
  }
  /** slot 削除(DELETE /files/slots/{id})。409=使用中 → lock へ倒す。 */
  private async deleteSlot(slotId: number): Promise<void> {
    if (!this.enabled) return;
    this.slotBusy = true; this.err = null;
    try {
      const r = await fetch(this.url(`/files/slots/${slotId}`), { method: "DELETE", headers: this.authHeaders() });
      if (r.status === 409) { this.runtimeLocked = new Set(this.runtimeLocked).add(slotId); return; }
      if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`);
      await this.loadSlots();
    } catch (e) { this.err = `${t("secretary.errDelete")}: ${String(e)}`; }
    finally { this.slotBusy = false; }
  }
  /** slot 内の1ファイル削除(DELETE /files/slots/{id}/files/{fileId})。 */
  private async deleteSlotFile(slotId: number, fileId: number): Promise<void> {
    if (!this.enabled) return;
    this.slotBusy = true; this.err = null;
    try {
      const r = await fetch(this.url(`/files/slots/${slotId}/files/${fileId}`), { method: "DELETE", headers: this.authHeaders() });
      if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`);
      await this.loadSlots();
    } catch (e) { this.err = `${t("secretary.errDelete")}: ${String(e)}`; }
    finally { this.slotBusy = false; }
  }
  /** hidden input を来源別(相册=image / 拍照=camera / slot追加=汎用)に開く。 */
  private pick(sel: string, target: number | null = null): void {
    this.addTargetSlot = target;
    (this.renderRoot.querySelector(sel) as HTMLInputElement | null)?.click();
  }

  /** 番号(user_seq ?? id)でタスクを解決し、選択して詳細(artifacts)を確保する。 */
  private async _resolveAndSelectTask(seq: number): Promise<Task | null> {
    await this.loadTasks();
    const task =
      this.tasks.find((tk) => (tk.user_seq ?? tk.id) === seq) ??
      this.tasks.find((tk) => tk.id === seq);
    if (!task) return null;
    if (this.selectedId !== task.id) {
      this.stopPoll();
      this.selectedId = task.id;
      this.artifacts = [];
      this.detailStatus = undefined;
      await this.pullDetail(); // await して artifacts をロード
      this.pollTimer = window.setInterval(() => void this.pullDetail(), POLL_MS);
    } else if (this.artifacts.length === 0) {
      await this.pullDetail();
    }
    return task;
  }

  /** タスクの成果物群から query(pdf/種別/ファイル名)で1つ選ぶ。 */
  private static _pickArtifact(arts: Artifact[], query: string): Artifact | undefined {
    if (arts.length === 0) return undefined;
    const ext = (a: Artifact) => (a.filename.split(".").pop() || "").toLowerCase();
    const norm = (s: string) => s.toLowerCase().replace(/[\s_\-.]+/g, "");
    const q = norm(query);
    // 種別ヒント優先(pdf/excel/word/画像)。名前ヒントがあれば同種別内で絞る。
    const pickType = (exts: string[], stripRe: RegExp): Artifact | undefined => {
      const inType = arts.filter((a) => exts.includes(ext(a)));
      if (inType.length === 0) return undefined;
      const nameHint = q.replace(stripRe, "");
      const byName = nameHint ? inType.find((a) => norm(a.filename).includes(nameHint)) : undefined;
      return byName ?? inType[0];
    };
    if (/pdf/.test(q)) return pickType(["pdf"], /pdf/g);
    if (/(xlsx|xls|excel|csv|表格)/.test(q)) return pickType(["xlsx", "xls", "csv"], /(xlsx|xls|excel|csv|表格)/g);
    if (/(docx|doc|word|文档|文檔)/.test(q)) return pickType(["doc", "docx"], /(docx|doc|word|文档|文檔)/g);
    if (/(png|jpg|jpeg|gif|webp|svg|图片|圖片|图像|圖像|截图|截圖|image|photo)/.test(q))
      return pickType(["png", "jpg", "jpeg", "gif", "webp", "svg"], /(png|jpe?g|gif|webp|svg|图片|圖片|图像|圖像|截图|截圖|image|photo)/g);
    // ファイル名の曖昧一致。
    if (q) {
      const hit =
        arts.find((a) => norm(a.filename) === q) ??
        arts.find((a) => norm(a.filename).includes(q)) ??
        arts.find((a) => q.includes(norm(a.filename.replace(/\.[^.]+$/, ""))) && norm(a.filename.replace(/\.[^.]+$/, "")));
      if (hit) return hit;
    }
    // 泛指 → 最初の PDF、無ければ SOURCE 以外、無ければ先頭。
    return (
      arts.find((a) => ext(a) === "pdf") ??
      arts.find((a) => !/^source\./i.test(a.filename)) ??
      arts[0]
    );
  }

  /**
   * 語音 task_artifact: 番号でタスクを解決し、その成果物を query で選んで preview を開く。
   * detail.payload = JSON {seq, query}。
   */
  private async _onVoiceTaskArtifact(e: CustomEvent): Promise<void> {
    if (!this.enabled) return;
    let seq = NaN;
    let query = "";
    try {
      const p = JSON.parse(((e.detail?.payload as string) || "{}")) as { seq?: unknown; query?: unknown };
      seq = Number(p.seq);
      query = String(p.query ?? "").trim();
    } catch { return; }
    if (!Number.isFinite(seq) || seq <= 0) return;
    const task = await this._resolveAndSelectTask(seq);
    if (!task) { this.err = `没有找到第 ${seq} 号任务`; return; }
    if (this.artifacts.length === 0) { this.err = `第 ${seq} 号任务还没有成果物`; return; }
    const art = SecretaryPanel._pickArtifact(this.artifacts, query);
    if (art) void this.openPreview(art);
  }

  /**
   * 語音 task_continue: 番号(user_seq)でタスクを解決し、そのタスクへ継続指示を送る。
   * detail.payload = JSON {seq, text}。選択→contMsg セット→continueTask を再利用。
   */
  private async _onVoiceTaskContinue(e: CustomEvent): Promise<void> {
    if (!this.enabled) return;
    let seq = NaN;
    let text = "";
    try {
      const p = JSON.parse(((e.detail?.payload as string) || "{}")) as { seq?: unknown; text?: unknown };
      seq = Number(p.seq);
      text = String(p.text ?? "").trim();
    } catch { return; }
    if (!Number.isFinite(seq) || seq <= 0 || !text) return;
    const task = await this._resolveAndSelectTask(seq);
    if (!task) { this.err = `没有找到第 ${seq} 号任务`; return; }
    this.contMsg = text;
    await this.continueTask();
  }

  /** 選択タスクへ継続指示(POST /tasks/{id}/messages)。winclaw が同一セッションで続行。 */
  private async continueTask(): Promise<void> {
    const text = this.contMsg.trim();
    if (!text || this.contBusy || this.selectedId == null || !this.enabled) return;
    this.contBusy = true; this.err = null;
    try {
      const r = await fetch(this.url(`/tasks/${this.selectedId}/messages`), {
        method: "POST",
        headers: { ...this.authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.contMsg = "";
      await this.loadTasks();
      // 継続で再び active になるので詳細ポーリングを開始。
      this.detailStatus = "running";
      this.stopPoll();
      void this.pullDetail();
      this.pollTimer = window.setInterval(() => void this.pullDetail(), POLL_MS);
    } catch (e) { this.err = `${t("secretary.errContinue")}: ${String(e)}`; }
    finally { this.contBusy = false; }
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
    } catch (e) { this.err = `${t("secretary.errDownload")}: ${String(e)}`; }
  }

  // ── 成果物 preview(html/pdf/画像/テキスト。ai-meta 経由=(い)proxy)──────────
  private static _kind(name: string): "html" | "pdf" | "image" | "text" | "none" {
    const e = (name.split(".").pop() || "").toLowerCase();
    if (["html", "htm"].includes(e)) return "html";
    if (e === "pdf") return "pdf";
    if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(e)) return "image";
    if (["txt", "md", "json", "csv", "js", "ts", "py", "css", "log", "yaml", "yml", "xml"].includes(e)) return "text";
    return "none";
  }
  private async openPreview(a: Artifact): Promise<void> {
    if (this.selectedId == null) return;
    const kind = SecretaryPanel._kind(a.filename);
    this.closePreview();
    if (kind === "none") { this.preview = { name: a.filename, kind, art: a }; return; }
    try {
      const r = await fetch(this.url(`/tasks/${this.selectedId}/artifacts/${a.id}`), { headers: this.authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (kind === "html" || kind === "text") {
        this.preview = { name: a.filename, kind, text: await r.text(), art: a };
      } else {
        this.preview = { name: a.filename, kind, url: URL.createObjectURL(await r.blob()), art: a };
      }
    } catch (e) { this.err = `${t("secretary.errPreview")}: ${String(e)}`; }
  }
  private closePreview(): void {
    if (this.preview?.url) { try { URL.revokeObjectURL(this.preview.url); } catch { /* noop */ } }
    this.preview = null;
  }

  // ── 节点成果物(エージェントが実際に書いた workspace ファイル。ai-meta proxy 経由)──
  private async loadNodeFiles(): Promise<void> {
    try {
      const r = await fetch(this.url("/tasks/nodefiles"), { headers: this.authHeaders() });
      if (!r.ok) return;
      const d = (await r.json()) as { files?: Array<{ name: string; path: string; size: number }> };
      const files = d.files ?? [];
      // 新規成果物の検知。初回ロード(_knownNodeFiles 空)は既知として取り込むだけ。
      // 2回目以降に増えた分は「新着」として window イベントで通知(数字人音声 or UI 用)。
      const prevKnown = this._knownNodeFiles;
      const isFirst = prevKnown.size === 0;
      const fresh = files.filter((f) => !prevKnown.has(f.path));
      for (const f of files) this._knownNodeFiles.add(f.path);
      this.nodeFiles = files;
      if (!isFirst && fresh.length > 0) {
        window.dispatchEvent(
          new CustomEvent("secretary-artifact-new", { detail: { files: fresh.map((f) => f.name) } }),
        );
      }
    } catch { /* best-effort */ }
  }
  private async openPreviewNode(f: { name: string; path: string }): Promise<void> {
    const kind = SecretaryPanel._kind(f.name);
    this.closePreview();
    if (kind === "none") { this.preview = { name: f.name, kind, nodePath: f.path }; return; }
    try {
      const r = await fetch(this.url(`/tasks/nodefile?path=${encodeURIComponent(f.path)}&disposition=inline`), { headers: this.authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (kind === "html" || kind === "text") {
        this.preview = { name: f.name, kind, text: await r.text(), nodePath: f.path };
      } else {
        this.preview = { name: f.name, kind, url: URL.createObjectURL(await r.blob()), nodePath: f.path };
      }
    } catch (e) { this.err = `${t("secretary.errPreview")}: ${String(e)}`; }
  }
  /**
   * Sprint D §4.3 / §5: ファイル名で成果物 popup を開く(語音 ui_action(artifact,show,name) 用)。
   * nodeFiles を模糊匹配(完全一致 → 部分一致 → 拡張子除去一致)。空引数/未命中は
   * 最新の成果物を開く(方案 §7-2「無 name → 最新」)。エラーは字幕/err に落として throw しない。
   */
  async openPreviewNodeByName(name: string): Promise<void> {
    if (!this.enabled) return;
    // 最新の一覧を確保(語音直後に生成された物にも追随)。
    if (this.nodeFiles.length === 0) { try { await this.loadNodeFiles(); } catch { /* noop */ } }
    const files = this.nodeFiles;
    if (files.length === 0) { this.err = t("secretary.noArtifactYet"); return; }
    const q = name.trim();
    // 分隔符(空格/下划线/连字符/点)+大小写を全て潰して比較 →「Tokyo hotel info の pdf」が
    // 「tokyo_hotel_info.pdf」に当たる(旧実装は下划线/点を残し content.json に誤爆した)。
    const norm = (s: string) => s.toLowerCase().replace(/[\s_\-.]+/g, "");
    const stem = (s: string) => norm(s.replace(/\.[^.]+$/, ""));         // 拡張子除去後に norm
    const nq = norm(q);
    let hit: { name: string; path: string; size: number } | undefined;
    if (nq) {
      hit = files.find((f) => norm(f.name) === nq)                        // 完全一致
        ?? files.find((f) => norm(f.name).includes(nq))                   // 名前に query 含む
        ?? files.find((f) => nq.includes(stem(f.name)) && stem(f.name))   // query に stem 含む
        ?? files.find((f) => stem(f.name).includes(nq));                  // stem に query 含む
    }
    // 名前未命中でも「拡張子/種別ヒント」で賢く兜底: 「pdf」「报告」等と言われたら
    // 最新の該当種別ファイルを開く(content.json など無関係な最新に誤爆しない)。
    if (!hit) {
      const ext = (rx: RegExp) => [...files].reverse().find((f) => rx.test(f.name));
      if (/pdf/i.test(q)) hit = ext(/\.pdf$/i);
      else if (/(图片|圖片|图|圖|image|photo|png|jpe?g)/i.test(q)) hit = ext(/\.(png|jpe?g|gif|webp|svg)$/i);
      else if (/(表格|表|csv|excel|xlsx?)/i.test(q)) hit = ext(/\.(csv|xlsx?)$/i);
      else if (/(文档|文檔|报告|報告|word|docx?)/i.test(q)) hit = ext(/\.(docx?|md|txt|pdf)$/i);
    }
    // それでも無ければ最新(末尾 = 直近生成)。
    if (!hit) hit = files[files.length - 1];
    await this.openPreviewNode({ name: hit.name, path: hit.path });
  }

  private async downloadNode(f: { name: string; path: string }): Promise<void> {
    try {
      const r = await fetch(this.url(`/tasks/nodefile?path=${encodeURIComponent(f.path)}&disposition=attachment`), { headers: this.authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const u = URL.createObjectURL(await r.blob());
      const link = document.createElement("a"); link.href = u; link.download = f.name; link.click();
      URL.revokeObjectURL(u);
    } catch (e) { this.err = `${t("secretary.errDownload")}: ${String(e)}`; }
  }

  private badge(s: string | undefined) {
    const cls = s === "done" ? "b-done" : s === "error" ? "b-err"
      : s === "running" || s === "pending" ? "b-run" : "b-idle";
    const txt = s === "done" ? t("secretary.badgeDone") : s === "error" ? t("secretary.badgeError")
      : s === "running" || s === "pending" ? t("secretary.badgeRunning") : t("secretary.badgeIdle");
    return html`<span class="badge ${cls}">${txt}</span>`;
  }

  render() {
    if (!this.enabled) {
      return html`<div class="disabled-note">${t("secretary.disabledTitle")}<br />${t("secretary.disabledHint")}</div>`;
    }
    const sel = this.tasks.find((tk) => tk.id === this.selectedId) ?? null;
    const headStatus = this.detailStatus ?? sel?.status;
    return html`
      <!-- ① 对话 / 字幕 -->
      <section class="card">
        <div class="head">
          <span class="ic i1">${icChat}</span>
          <h3>${t("secretary.dialogTitle")}</h3>
          ${this.badge(headStatus)}
        </div>
        <div class="statusbar">${this.subtitle || t("secretary.subtitlePlaceholder")}</div>
      </section>

      <!-- 🎵 音乐(内蔵 music bundle・docs/20): 語音点歌で _music が入ると出現。循环再生。 -->
      ${this._music
        ? html`
          <section class="card">
            <div class="head"><span class="ic i1">${icMusic}</span><h3>音乐</h3></div>
            <dh-music-player
              .track=${this._music}
              .paused=${this._musicPaused}
              @music-stop=${() => { this._music = null; this._musicPaused = false; }}
            ></dh-music-player>
          </section>`
        : nothing}

      <!-- ② 任务 & 成果物: 番号付き一覧 + 選択タスクの成果物 + 継続指示。
           「生成的成果物」独立区は削除(各タスク配下に成果物があるため。2026-07-05 要望)。 -->
      <section class="card">
        <div class="head"><span class="ic i2">${icTask}</span><h3>${t("secretary.tasksTitle")}</h3></div>
        ${this.err ? html`<p class="err">${this.err}</p>` : nothing}
        ${this.tasks.length === 0
          ? html`<p class="muted">${t("secretary.noTasks")}</p>`
          : html`<ul class="tasklist">${this.tasks.map((task) => {
              const active = task.id === this.selectedId;
              const st = active && this.detailStatus ? this.detailStatus : task.status;
              const slotName = task.slot_id != null ? this.slots.find((s) => s.id === task.slot_id)?.name : null;
              const seq = task.user_seq ?? task.id;
              const nm = (task.name && task.name.trim()) || task.prompt;
              return html`<li>
                <button class="taskitem ${active ? "sel" : ""}" @click=${() => this.select(task.id)}>
                  <span class="chev">${icChevron}</span>
                  <span class="seq">#${seq}</span>
                  <span class="p">${nm}</span>
                  ${slotName ? html`<span class="badge b-slot">${slotName}</span>` : nothing}
                  ${this.badge(st)}
                </button>
                ${active ? html`<div class="arts">
                  ${task.github_url ? html`<a class="art gh" href=${task.github_url} target="_blank" rel="noopener">${icGit} GitHub</a>` : nothing}
                  ${this.artifacts.length === 0
                    ? html`<span class="muted">${ACTIVE.has(st) ? t("secretary.artifactsRunning") : t("secretary.artifactsEmpty")}</span>`
                    : this.artifacts.map((a) => html`<span class="art" title=${t("secretary.preview")} @click=${() => void this.openPreview(a)}>${icEye}<span class="art-nm">${a.filename}</span><span class="art-dl" title=${t("secretary.download")} @click=${(e: Event) => { e.stopPropagation(); void this.download(a); }}>${icDl}</span></span>`)}
                </div>
                <div class="cont">
                  <textarea
                    .value=${this.contMsg}
                    placeholder=${t("secretary.continuePlaceholder")}
                    @input=${(e: Event) => (this.contMsg = (e.target as HTMLTextAreaElement).value)}
                    @compositionstart=${() => (this._composing = true)}
                    @compositionend=${() => (this._composing = false)}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === "Enter" && !e.shiftKey && !this._composing && !(e as unknown as { isComposing: boolean }).isComposing) {
                        e.preventDefault(); void this.continueTask();
                      }
                    }}></textarea>
                  <div class="row">
                    <button class="primary" ?disabled=${this.contBusy || this.contMsg.trim() === ""} @click=${() => void this.continueTask()}>
                      ${this.contBusy ? html`<span class="spin">${icSpin}</span>` : icSend}
                      ${this.contBusy ? t("secretary.sending") : t("secretary.send")}
                    </button>
                  </div>
                </div>` : nothing}
              </li>`;
            })}</ul>`}
      </section>

      <!-- ③ 资料 Slot(タスク管理画面と同等: 追加/削除/文件削除 + 相册/拍照アップロード) -->
      <section class="card">
        <div class="head"><span class="ic i3">${icFolder}</span><h3>${t("secretary.slotTitle")}</h3></div>
        <div class="drop ${this.over ? "over" : ""}"
          @click=${() => this.pick("#fpick")}
          @dragover=${(e: DragEvent) => { e.preventDefault(); this.over = true; }}
          @dragleave=${() => (this.over = false)}
          @drop=${(e: DragEvent) => { e.preventDefault(); this.over = false; void this.doUpload(e.dataTransfer ? Array.from(e.dataTransfer.files) : []); }}>
          <span class="up">${this.uploading ? html`<span class="spin">${icSpin}</span>` : icUpload}</span>
          <span>${this.uploading ? t("secretary.uploading") : t("secretary.dropHint")}</span>
        </div>
        <!-- 相册 / 拍照(新規 slot を作成) -->
        <div class="src-row">
          <button class="src-btn" @click=${() => this.pick("#apick")}>${icImage} ${t("secretary.fromAlbum")}</button>
          <button class="src-btn" @click=${() => this.pick("#cpick")}>${icCamera} ${t("secretary.startCamera")}</button>
        </div>
        <!-- hidden inputs: 汎用 / 相册(image) / 拍照(camera) / slot追加 -->
        <input id="fpick" type="file" multiple style="display:none"
          @change=${(e: Event) => { const inp = e.target as HTMLInputElement; void this.doUpload(inp.files ? Array.from(inp.files) : []); inp.value = ""; }} />
        <input id="apick" type="file" accept="image/*" multiple style="display:none"
          @change=${(e: Event) => { const inp = e.target as HTMLInputElement; void this.doUpload(inp.files ? Array.from(inp.files) : []); inp.value = ""; }} />
        <input id="cpick" type="file" accept="image/*" capture="environment" style="display:none"
          @change=${(e: Event) => { const inp = e.target as HTMLInputElement; void this.doUpload(inp.files ? Array.from(inp.files) : []); inp.value = ""; }} />
        <input id="addpick" type="file" multiple style="display:none"
          @change=${(e: Event) => { const inp = e.target as HTMLInputElement; const sid = this.addTargetSlot; this.addTargetSlot = null; if (sid != null) void this.addToSlot(sid, inp.files ? Array.from(inp.files) : []); inp.value = ""; }} />
        ${this.slots.length === 0
          ? html`<p class="muted">${t("secretary.noSlots")}</p>`
          : html`<ul class="slotlist">${this.slots.map((s) => {
              const locked = this.slotLocked(s.id);
              return html`<li class="slotcard">
              <div class="top">
                <span class="nm">${s.name}</span>
                <span class="muted">${t("secretary.fileCount", { count: s.files.length })}</span>
                <button class="act" title=${t("secretary.addFiles")} aria-label=${t("secretary.addFiles")}
                  ?disabled=${this.slotBusy} @click=${() => this.pick("#addpick", s.id)}>${icPlus}</button>
                ${locked
                  ? html`<span class="act lock" title=${t("secretary.slotInUse")} aria-label=${t("secretary.slotInUse")}>${icLock}</span>`
                  : html`<button class="act del" title=${t("secretary.deleteSlot")} aria-label=${t("secretary.deleteSlot")}
                      ?disabled=${this.slotBusy} @click=${() => void this.deleteSlot(s.id)}>${icTrash}</button>`}
              </div>
              ${s.files.map((f) => html`<div class="file">${icFile}<span class="fn">${f.filename}</span>
                <span class="fdel" title=${t("secretary.deleteFile")} aria-label=${t("secretary.deleteFile")}
                  @click=${() => void this.deleteSlotFile(s.id, f.id)}>${icX}</span></div>`)}
              ${locked ? html`<div class="lockhint">${icLock}${t("secretary.slotInUse")}</div>` : nothing}
            </li>`;
            })}</ul>`}
      </section>

      ${this.preview ? html`
        <div class="pv-mask" @click=${() => this.closePreview()}>
          <div class="pv-box" @click=${(e: Event) => e.stopPropagation()}>
            <div class="pv-head">
              <span class="pv-name">${this.preview.name}</span>
              ${this.preview.art ? html`<button class="pv-dl" @click=${() => this.preview?.art && void this.download(this.preview.art)}>${icDl} ${t("secretary.download")}</button>`
                : this.preview.nodePath ? html`<button class="pv-dl" @click=${() => { const p = this.preview; if (p?.nodePath) void this.downloadNode({ name: p.name, path: p.nodePath }); }}>${icDl} ${t("secretary.download")}</button>`
                : nothing}
              <button class="pv-x" title=${t("secretary.close")} @click=${() => this.closePreview()}>✕</button>
            </div>
            <div class="pv-body">
              ${this.preview.kind === "html" ? html`<iframe class="pv-frame" sandbox="allow-scripts" .srcdoc=${this.preview.text ?? ""}></iframe>`
                : this.preview.kind === "text" ? html`<pre class="pv-pre">${this.preview.text ?? ""}</pre>`
                : this.preview.kind === "image" ? html`<img class="pv-img" src=${this.preview.url ?? ""} alt=${this.preview.name} />`
                : this.preview.kind === "pdf" ? html`<iframe class="pv-frame" src=${this.preview.url ?? ""}></iframe>`
                : html`<div class="pv-none">${t("secretary.previewUnsupported")}</div>`}
            </div>
          </div>
        </div>` : nothing}
    `;
  }
}

// ── inline SVG icons (stroke=currentColor) ───────────────────────────────────
const svg = (inner: unknown, w = 15) => html`<svg viewBox="0 0 24 24" width=${w} height=${w} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const icChat = svg(svgIcon`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`, 15);
const icMusic = svg(svgIcon`<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`, 15);
const icTask = svg(svgIcon`<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`, 15);
const icFolder = svg(svgIcon`<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`, 15);
const icMic = svg(svgIcon`<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>`, 16);
const icSend = svg(svgIcon`<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>`, 15);
const icSpin = svg(svgIcon`<path d="M21 12a9 9 0 1 1-6.219-8.56"/>`, 15);
const icChevron = svg(svgIcon`<polyline points="9 18 15 12 9 6"/>`, 15);
const icUpload = svg(svgIcon`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>`, 26);
const icFile = svg(svgIcon`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`, 14);
const icDl = svg(svgIcon`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`, 14);
const icEye = svg(svgIcon`<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>`, 14);
const icRefresh = svg(svgIcon`<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`, 14);
const icGit = svg(svgIcon`<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>`, 14);
const icImage = svg(svgIcon`<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>`, 15);
const icCamera = svg(svgIcon`<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>`, 15);
const icPlus = svg(svgIcon`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`, 16);
const icLock = svg(svgIcon`<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`, 14);
const icTrash = svg(svgIcon`<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`, 15);
const icX = svg(svgIcon`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`, 14);

declare global {
  interface HTMLElementTagNameMap { "secretary-panel": SecretaryPanel; }
}
