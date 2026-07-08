/**
 * music-player.ts — 内蔵 music bundle(docs/20 §4.2)の音乐播放器 Lit 组件。
 *
 * 右 secretary-panel の「音乐」カード内に載る。`<audio loop>` を1つ持ち、親から
 * `track`(playUrl/title/artist/cover/loop)を受けて **循环再生**する。停止は親が
 * `track=null` にする(= 要素が消える→音声も止まる)か、内部の停止ボタンで
 * `music-stop` を親へ発火する。voice 「暂停」は親が `paused` を切替える。
 *
 * 契約:
 *   - 親(secretary-panel)が `dh-ui-music`(app-render 経由)を購読し、
 *     play → track 設定 / stop → track=null / pause → paused=true。
 *   - 本组件は presentational + `<audio>` 生命周期のみ担当(音源解决は node 側)。
 *
 * ★版权=テスト/PoC(直リンク再生)。見た目は secretary-panel と同じ brand 暗色。
 */
import { LitElement, html, css, svg as svgIcon, nothing, type PropertyValues } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";

/** 親から渡る再生対象。 */
export interface MusicTrackView {
  playUrl: string;
  title: string;
  artist?: string;
  cover?: string;
  loop?: boolean;
  source?: string;
}

const icNote = svgIcon`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
const icPlay = svgIcon`<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const icPause = svgIcon`<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`;
const icStop = svgIcon`<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>`;

@customElement("dh-music-player")
export class MusicPlayer extends LitElement {
  static styles = css`
    :host {
      --brand-pink: #f0759b;
      --grad-warm: linear-gradient(135deg, #ff8a65, #f0759b 55%, #8b78d6);
      --ink-2: #171120;
      --ink-3: #20182e;
      --ink-line: #332741;
      --tx: #f6f1fb;
      --tx-mut: #b7aac9;
      --live: #7cffc0;
      display: block;
    }
    .wrap { display: flex; gap: 12px; align-items: center; }
    .cover {
      width: 56px; height: 56px; border-radius: 12px; flex: 0 0 auto;
      background: var(--grad-warm); object-fit: cover; display: grid; place-items: center;
      color: #1a0f12; box-shadow: 0 6px 16px -8px rgba(0, 0, 0, .7); overflow: hidden;
    }
    .cover img { width: 100%; height: 100%; object-fit: cover; }
    .cover .ph { transform: scale(1.6); opacity: .9; }
    .meta { flex: 1; min-width: 0; }
    .title {
      font-weight: 650; font-size: 13.5px; color: var(--tx); white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
      font-family: "Poppins", "Inter", "Noto Sans SC", sans-serif;
    }
    .artist {
      font-size: 12px; color: var(--tx-mut); margin-top: 2px; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    .now { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--live); margin-top: 4px; }
    .bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 11px; }
    .bars i { width: 2.5px; background: var(--live); border-radius: 2px; animation: eq 900ms ease-in-out infinite; }
    .bars i:nth-child(1) { height: 40%; animation-delay: 0ms; }
    .bars i:nth-child(2) { height: 90%; animation-delay: 150ms; }
    .bars i:nth-child(3) { height: 60%; animation-delay: 300ms; }
    .bars i:nth-child(4) { height: 100%; animation-delay: 80ms; }
    .paused .bars i { animation-play-state: paused; opacity: .5; }
    @keyframes eq { 0%, 100% { transform: scaleY(.4); } 50% { transform: scaleY(1); } }
    @media (prefers-reduced-motion: reduce) { .bars i { animation: none; } }
    .ctrls { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; }
    button {
      border: 1px solid var(--ink-line); background: var(--ink-3); color: var(--tx);
      border-radius: 10px; cursor: pointer; display: grid; place-items: center;
      transition: border-color .15s, background .15s, transform .1s;
    }
    button:hover { border-color: var(--brand-pink); }
    button:active { transform: scale(.94); }
    button:focus-visible { outline: 2px solid var(--brand-pink); outline-offset: 2px; }
    .pp { width: 40px; height: 40px; background: var(--grad-warm); border: none; color: #1a0f12; }
    .pp:hover { filter: brightness(1.06); }
    .sm { width: 32px; height: 32px; color: var(--tx-mut); }
    audio { display: none; }
  `;

  @property({ attribute: false }) track: MusicTrackView | null = null;
  /** voice「暂停」時に親が true にする(内部ボタンでも切替可)。 */
  @property({ type: Boolean }) paused = false;

  @state() private _playing = false;
  @query("audio") private _audio!: HTMLAudioElement;
  private _lastUrl = "";
  /** 再生したい状態か(pause/stop で false)。gesture リトライの条件に使う。 */
  private _wantPlay = false;
  /** 自動再生ブロック時に仕込む「次のユーザ操作で再試行」ハンドラ。 */
  private _gestureHandler: (() => void) | null = null;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._disarmGestureUnlock();
  }

  protected updated(changed: PropertyValues): void {
    const audio = this._audio;
    if (!audio) return;
    // 新しい曲 → src 差替 + 循环 + 自動再生。
    if (changed.has("track")) {
      const url = this.track?.playUrl ?? "";
      if (url && url !== this._lastUrl) {
        this._lastUrl = url;
        audio.loop = this.track?.loop !== false;
        // ★換 src の前に必ず pause():連続 dispatch で「play() interrupted by new
        //   load」reject → 「已暂停」になるのを防ぐ。
        audio.pause();
        audio.src = url;
        audio.load();
        this._wantPlay = !this.paused;
        if (this._wantPlay) void this._requestPlay();
      } else if (!url) {
        this._lastUrl = "";
        this._wantPlay = false;
        audio.pause();
        this._playing = false;
      }
    }
    // voice / 親からの pause 切替(track と同時変化時は上で処理済なので除外)。
    if (changed.has("paused") && !changed.has("track")) {
      if (this.paused) {
        this._wantPlay = false;
        audio.pause();
        this._playing = false;
      } else if (this._lastUrl) {
        this._wantPlay = true;
        void this._requestPlay();
      }
    }
  }

  /** play() を試み、自動再生ブロック時は次のユーザ操作での自動リトライを仕込む。 */
  private async _requestPlay(): Promise<void> {
    const ok = await this._tryPlay();
    if (!ok && this._wantPlay) this._armGestureUnlock();
  }

  private async _tryPlay(): Promise<boolean> {
    try {
      await this._audio.play();
      this._playing = true;
      this._disarmGestureUnlock();
      return true;
    } catch (err) {
      // 自動再生ブロック / interrupted。ボタン or 次のユーザ操作で再開できる。
      this._playing = false;
      console.debug("[music-player] play blocked:", (err as Error)?.name);
      return false;
    }
  }

  /**
   * 跨域 iframe / 自動再生ポリシーで最初の play() が弾かれた時、ドキュメントの
   * 次のユーザ操作(タップ/クリック/キー)を1回捕まえて再生を再試行する。
   * これで「語音点歌 → 一度どこかをタップ → 再生開始」が成立する(直接のボタン
   * クリックは _togglePlay で即再生)。
   */
  private _armGestureUnlock(): void {
    if (this._gestureHandler) return;
    const handler = (): void => {
      this._disarmGestureUnlock();
      if (this._wantPlay && this._lastUrl) void this._requestPlay();
    };
    this._gestureHandler = handler;
    const opts = { capture: true } as AddEventListenerOptions;
    document.addEventListener("pointerdown", handler, opts);
    document.addEventListener("keydown", handler, opts);
    document.addEventListener("touchend", handler, opts);
  }

  private _disarmGestureUnlock(): void {
    const h = this._gestureHandler;
    if (!h) return;
    this._gestureHandler = null;
    const opts = { capture: true } as EventListenerOptions;
    document.removeEventListener("pointerdown", h, opts);
    document.removeEventListener("keydown", h, opts);
    document.removeEventListener("touchend", h, opts);
  }

  private _togglePlay(): void {
    if (this._playing) {
      this._wantPlay = false;
      this._audio.pause();
      this._playing = false;
      this.paused = true;
    } else {
      // ボタンクリック = ユーザ操作 → 直接 play() が通る。
      this.paused = false;
      this._wantPlay = true;
      void this._requestPlay();
    }
  }

  private _stop(): void {
    this._wantPlay = false;
    this._disarmGestureUnlock();
    this._audio.pause();
    this._audio.currentTime = 0;
    this._playing = false;
    this._lastUrl = "";
    this.dispatchEvent(new CustomEvent("music-stop", { bubbles: true, composed: true }));
  }

  render() {
    const tr = this.track;
    if (!tr) return nothing;
    const playing = this._playing && !this.paused;
    return html`
      <div class="wrap ${playing ? "" : "paused"}">
        <div class="cover">
          ${tr.cover
            ? html`<img src=${tr.cover} alt="" @error=${(e: Event) => ((e.target as HTMLElement).style.display = "none")} />`
            : html`<span class="ph">${icNote}</span>`}
        </div>
        <div class="meta">
          <div class="title" title=${tr.title}>${tr.title}</div>
          ${tr.artist ? html`<div class="artist">${tr.artist}</div>` : nothing}
          <div class="now">
            <span class="bars"><i></i><i></i><i></i><i></i></span>
            ${playing ? "循环播放中" : "已暂停"}
          </div>
        </div>
        <div class="ctrls">
          <button class="pp" @click=${this._togglePlay}
            aria-label=${playing ? "暂停" : "播放"} title=${playing ? "暂停" : "播放"}>
            ${playing ? icPause : icPlay}
          </button>
          <button class="sm" @click=${this._stop} aria-label="停止" title="停止">${icStop}</button>
        </div>
      </div>
      <audio preload="auto" @ended=${() => { if (this.track?.loop === false) this._playing = false; }}></audio>
    `;
  }
}
