/**
 * main-layout.ts
 *
 * The v3 split-screen main layout that presents the Digital Human panel on the
 * left (or top in portrait) and the text Chat panel on the right (or bottom).
 *
 * This module is a pure render function following the same functional pattern
 * used throughout the WinClaw UI codebase (no LitElement class — it composes
 * into the host `WinClawApp` component via its `render()` / `renderApp()`
 * call chain).
 *
 * Layout modes
 * ────────────
 *   split          – both panels share equal space (default)
 *   dh-fullscreen  – DH panel takes 100%, chat is hidden
 *   chat-fullscreen – chat panel takes 100%, DH is hidden
 *
 * Orientation detection
 * ─────────────────────
 *   landscape – flex-direction: row  (side-by-side)
 *   portrait  – flex-direction: column (DH 40vh top, chat below)
 *
 * The CSS transitions are defined in layout-v3.css; this module only sets the
 * appropriate class names on the container element.
 */

import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { renderDigitalHumanPanel, type DHPanelState } from "./digital-human.ts";
import { renderChat, type ChatProps } from "./chat.ts";
// 数字人秘书 A案(docs/10 §4.2): 右区を 3 段パネル(カスタム要素)へ。副作用 import で登録。
import "../components/secretary-panel.ts";

// ---------------------------------------------------------------------------
// Sprint D §4.5: 秘书面板 / 控制条 の表示切替(自包含 DOM 駆動)
// ---------------------------------------------------------------------------
// app-render(state 構築点)は本 Sprint の担当外(4 ファイル制約)。よって
// dhTaskPanelOpen/dhControlsVisible の切替は Lit の再レンダを経由せず、
// .shell--secretary 上の class を直接 toggle する(ボタン click と ui_action の
// 双方から同一 helper を呼ぶ = 方案 §5 双通道等価)。
// PC: パネルは既定で隠す(class 無=隠す / .task-open=右サイドバー表示)。
// 手机: .task-open で底部 sheet を弾出。控制条は既定表示 / .controls-hidden で隠す。

// ★二重 shell 注意: task-open / controls-hidden の CSS は **外側** .shell--dh を読む
// (.shell--dh.task-open .panel-secretary / .shell--dh.controls-hidden .dh-controls)。
// 内側 .shell--secretary に付けても効かない(実機で panel が展開しない bug)。外側へ。
const SHELL_SEL = ".shell--dh";

function shellEl(): HTMLElement | null {
  return document.querySelector(SHELL_SEL);
}
function setTaskPanelOpen(open: boolean): void {
  shellEl()?.classList.toggle("task-open", open);
}
function toggleTaskPanel(): void {
  const el = shellEl();
  if (el) el.classList.toggle("task-open");
}
function setControlsVisible(visible: boolean): void {
  shellEl()?.classList.toggle("controls-hidden", !visible);
}
function toggleControls(): void {
  const el = shellEl();
  if (el) el.classList.toggle("controls-hidden");
}
// 沉浸(全屏)モード: 秘书面板・控制条・悬浮ボタンを隠し、数字人 stage を全画面化。
// ★browser の requestFullscreen() はユーザ操作(gesture)必須で語音からは拒否される。
// よって語音「全屏」は本 CSS 沉浸で実現する(手动ダブルクリック/ボタンは従来通り真の
// browser fullscreen)。dh-immersive を .shell--dh へ toggle するだけ(CSS は下 <style>)。
function setImmersive(on: boolean): void {
  shellEl()?.classList.toggle("dh-immersive", on);
}
function toggleImmersive(): void {
  const el = shellEl();
  if (el) el.classList.toggle("dh-immersive");
}

/**
 * ui_action(task_panel/controls) の client 分派を DOM 切替へ橋渡し(方案 §3.4)。
 * dh-websocket が発火する 'dh-ui-action' (detail.{target,action}) を購読。
 * artifact は secretary-panel が 'dh-ui-artifact' で別途処理するので此処では扱わない。
 * mic/camera/avatar は既存ボタン handler(app-render)側で処理される想定。
 * モジュール一度きり登録(純関数 render の多重呼出でも二重登録しない)。
 */
// PC 既定で秘书面板を表示(chat.html SSOT)。shell mount 後に一度だけ .shell--dh へ
// task-open を付与(手机 <1024 は付けない=底部 sheet 隐藏のまま)。
let _defaultTaskApplied = false;
function ensureDefaultTaskOpen(): void {
  if (_defaultTaskApplied || typeof window === "undefined") return;
  let tries = 0;
  const apply = (): void => {
    const el = shellEl();
    if (el) {
      _defaultTaskApplied = true;
      if (window.innerWidth >= 1024) el.classList.add("task-open");
      return;
    }
    if (tries++ < 12) setTimeout(apply, 60);
  };
  setTimeout(apply, 0);
}

let _uiActionBound = false;
function ensureUiActionListener(): void {
  if (_uiActionBound || typeof window === "undefined") return;
  _uiActionBound = true;
  window.addEventListener("dh-ui-action", (e: Event) => {
    const d = (e as CustomEvent).detail as { target?: string; action?: string; name?: string } | undefined;
    if (!d) return;
    const act = d.action ?? "toggle";
    const on = act === "show" || act === "open" || act === "on";
    const off = act === "hide" || act === "close" || act === "off";
    if (d.target === "task_panel") {
      if (on) setTaskPanelOpen(true);
      else if (off) setTaskPanelOpen(false);
      else toggleTaskPanel();
    } else if (d.target === "controls") {
      if (on) setControlsVisible(true);
      else if (off) setControlsVisible(false);
      else toggleControls();
    } else if (d.target === "fullscreen") {
      // 全屏 = 沉浸モード(CSS)。on=沉浸に入る / off=解除 / それ以外=toggle。
      if (on) setImmersive(true);
      else if (off) setImmersive(false);
      else toggleImmersive();
    } else if (d.target === "artifact") {
      // 開く=名前指定で成果物 popup(secretary-panel の 'dh-ui-artifact' 入口へ委譲)。
      // 閉じる=プレビュー popup を閉じる('dh-ui-artifact-close')。
      if (off) window.dispatchEvent(new CustomEvent("dh-ui-artifact-close"));
      else window.dispatchEvent(new CustomEvent("dh-ui-artifact", { detail: { name: d.name } }));
    }
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LayoutMode = "split" | "dh-fullscreen" | "chat-fullscreen";
export type LayoutOrientation = "landscape" | "portrait";

export interface MainLayoutState {
  // ── Layout config ─────────────────────────────────────────────────────────
  /** Current display mode; drives CSS class on .main-container */
  layoutMode: LayoutMode;
  /** Detected orientation; drives CSS class for flex direction */
  orientation: LayoutOrientation;

  // ── Sub-panel state ────────────────────────────────────────────────────────
  /** All state needed to render the Digital Human panel */
  dhPanel: DHPanelState;
  /** All props needed to render the Chat panel (existing ChatProps shape) */
  chatPanel: ChatProps;

  // ── 数字人秘书 A案 身份桥(docs/10 §14.5) ───────────────────────────────────
  /** ai-meta scoped token(節点 UI が /files /tasks を叩く用)。null=秘书機能無効。 */
  aimetaToken: string | null;
  /** ai-meta API base(例 http://localhost:8000)。前端が DH URL ?api= で渡す。 */
  aimetaApi: string | null;

  // ── Topbar / branding ─────────────────────────────────────────────────────
  /** DH / assistant display name shown in the simplified topbar */
  assistantName: string;
  /** Whether the DH session is online (drives status dot colour) */
  dhOnline: boolean;
  /** Base path for asset resolution (forwarded from AppViewState) */
  basePath: string;

  // ── Callbacks ─────────────────────────────────────────────────────────────
  /** Set the layout mode (fullscreen toggle) */
  onSetLayoutMode: (mode: LayoutMode) => void;
  /** Open the settings view */
  onOpenSettings: () => void;
  /** Cycle / toggle the theme */
  onToggleTheme: () => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Fullscreen expand SVG icon */
function iconExpand() {
  return html`<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
    <polyline points="15 3 21 3 21 9"/>
    <polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
    <line x1="3" y1="21" x2="10" y2="14"/>
  </svg>`;
}

/** Fullscreen compress / restore SVG icon */
function iconCompress() {
  return html`<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
    <polyline points="4 14 10 14 10 20"/>
    <polyline points="20 10 14 10 14 4"/>
    <line x1="10" y1="14" x2="3" y2="21"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
  </svg>`;
}

/** 任务面板 切替アイコン(パネル/レイアウト) */
function iconPanelToggle() {
  return html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2"/>
    <line x1="15" y1="4" x2="15" y2="20"/>
  </svg>`;
}

/** 控制条 表示/隐藏 把手アイコン(chevron) */
function iconControlsHandle() {
  return html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>`;
}

function iconSettings() {
  return html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`;
}

function iconTheme() {
  return html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`;
}

/**
 * Simplified topbar for the v3 layout.
 * Left: DH name + online status dot
 * Right: language selector slot, settings button, theme toggle
 */
function renderTopbarV3(state: MainLayoutState) {
  const faviconSrc = state.basePath ? `${state.basePath}/favicon.svg` : "/favicon.svg";

  return html`
    <header class="topbar topbar-v3" role="banner">
      <div class="topbar-v3__left">
        <div class="brand">
          <div class="brand-logo">
            <img src=${faviconSrc} alt="WinClaw" />
          </div>
        </div>
        <div class="dh-identity" aria-label=${t("dh.panelLabel")}>
          <span
            class="statusDot ${state.dhOnline ? "ok" : ""}"
            title=${t(state.dhOnline ? "dh.statusConnected" : "dh.statusDisconnected")}
          ></span>
          <span class="dh-identity__name">${state.assistantName}</span>
        </div>
      </div>

      <div class="topbar-v3__right">
        <!-- Language selector is rendered by the caller via a slot / container -->
        <div id="topbar-lang-slot" class="topbar-v3__lang-slot"></div>

        <button
          class="topbar-icon-btn"
          @click=${state.onOpenSettings}
          title=${t("nav.settings")}
          aria-label=${t("nav.settings")}
        >
          ${iconSettings()}
        </button>

        <button
          class="topbar-icon-btn"
          @click=${state.onToggleTheme}
          title=${t("nav.theme")}
          aria-label=${t("nav.theme")}
        >
          ${iconTheme()}
        </button>
      </div>
    </header>
  `;
}

/**
 * Toggle browser fullscreen for a given panel element.
 */
async function toggleBrowserFullscreen(panelSelector: string) {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    const panel = document.querySelector(panelSelector) as HTMLElement | null;
    if (panel) {
      await panel.requestFullscreen();
    }
  }
}

/**
 * Fullscreen toggle button for the DH panel.
 * Shown in the top-right corner of the panel when hovering or focused.
 */
function renderDHFullscreenToggle(_state: MainLayoutState) {
  const isFullscreen = !!document.fullscreenElement;
  const label = t(isFullscreen ? "layout.exitFullscreen" : "layout.dhFullscreen");

  return html`
    <button
      class="panel-fullscreen-btn"
      @click=${() => toggleBrowserFullscreen(".panel-dh")}
      title=${label}
      aria-label=${label}
    >
      ${isFullscreen ? iconCompress() : iconExpand()}
    </button>
  `;
}

/**
 * Fullscreen toggle button for the chat panel.
 */
function renderChatFullscreenToggle(_state: MainLayoutState) {
  const isFullscreen = !!document.fullscreenElement;
  const label = t(isFullscreen ? "layout.exitFullscreen" : "layout.chatFullscreen");

  return html`
    <button
      class="panel-fullscreen-btn"
      @click=${() => toggleBrowserFullscreen(".panel-chat")}
      title=${label}
      aria-label=${label}
    >
      ${isFullscreen ? iconCompress() : iconExpand()}
    </button>
  `;
}

// ---------------------------------------------------------------------------
// Public render function
// ---------------------------------------------------------------------------

/**
 * Renders the complete v3 main layout: simplified topbar + split-screen body.
 *
 * Intended to replace the `renderApp()` call for the primary chat/DH view.
 * Settings and other auxiliary views are rendered by the host component when
 * the appropriate mode / tab is active.
 */
export function renderMainLayout(state: MainLayoutState) {
  /** CSS classes on the main container drive the flex layout and transitions */
  const containerClasses = [
    "main-container",
    `layout-${state.layoutMode}`,
    `orientation-${state.orientation}`,
  ].join(" ");

  // 数字人秘书 A案(docs/10 §4.2): 顶栏(renderTopbarV3)は削除。右区は chat ではなく
  // 秘书 3 段パネル(secretary-panel)。renderChat/renderChatFullscreenToggle/renderTopbarV3 は
  // 従来 chat タブ用に残置(未使用参照回避のため下で void 参照)。
  void renderChat;
  void renderChatFullscreenToggle;
  void renderTopbarV3;

  // Sprint D §3.4/§4.5: ui_action(task_panel/controls/artifact) → DOM 切替の購読。
  ensureUiActionListener();
  // PC(≥1024)は秘书面板を既定で表示(視覚正本 chat.html = 右栏可見)。手机は既定隐藏
  // (底部 sheet, ユーザ/语音で弹出)。二重 shell の外側 .shell--dh に task-open を付与。
  ensureDefaultTaskOpen();

  return html`
    <style>
      /* 数字人秘书 A案(docs/10 §4.2): DH タブ表示中のみ外側の顶栏/セッションタブを隠す
         (この <style> は DH レンダリング時だけ DOM に存在 → 他タブに影響しない)。 */
      .shell--dh > .topbar { display: none !important; }
      /* 旧 topbar 領域の余白を除去。shell は grid(named areas: topbar/main/statusbar)。
         topbar 行を 0 に潰す。★statusbar footer は削除済(ユーザ要望 2026-07-07)なので
         statusbar 行も 0 に潰す(でないと底部に 32px の空白帯が残る)。 */
      .shell--dh { padding: 0 !important; gap: 0 !important; grid-template-rows: 0 1fr 0 !important; }
      .shell--dh .shell--secretary {
        grid-template-rows: 0 1fr 0 !important; margin: 0 !important;
      }
      .shell--dh .session-tabs { display: none !important; }
      .shell--dh .content-header { display: none !important; }
      /* DH タブの外側余白/背景も設計稿(§4.2)に合わせて詰める */
      .shell--dh > .content { padding: 0 !important; gap: 0 !important; }
      .shell--dh .main-container { height: 100% !important; }

      /* ════════════════════════════════════════════════════════════════════
         Sprint D §4.4 視覚統一 — brand token(ai-meta §3.4 复刻・值精确一致)
         .shell--dh を作用域根に定義 → stage / 控制条(shadow 外 CSS)へ波及。
         ※品牌色変更時は ai-meta(tailwind)側と両方同期(方案 §7-10)。
         ════════════════════════════════════════════════════════════════════ */
      .shell--dh {
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
      }

      /* ── stage(数字人区)= 暗底 + 顶部径向暖粉光晕(chat.html 対話面)──────── */
      .shell--dh .panel-dh { background: var(--ink) !important; border-right-color: var(--ink-line) !important; }
      .shell--dh .dh-panel {
        background:
          radial-gradient(75% 60% at 50% 26%, rgba(247, 168, 196, .22), transparent 70%),
          var(--ink) !important;
      }
      .shell--dh .dh-video-container {
        background: #06040a !important;
        box-shadow: inset 0 0 0 1px var(--ink-line) !important;
      }
      .shell--dh .dh-start-hint {
        background: var(--ink-3) !important; border-color: var(--ink-line) !important; color: var(--tx-mut) !important;
      }
      .shell--dh .dh-placeholder:hover .dh-start-hint { color: var(--brand-pink) !important; border-color: var(--brand-pink) !important; }
      /* 字幕を玻璃拟态浮层へ */
      .shell--dh .dh-subtitle {
        background: rgba(15, 11, 21, .66) !important;
        backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important;
        border-top-color: var(--ink-line) !important;
      }
      .shell--dh .dh-subtitle-text { color: var(--tx) !important; }

      /* ── 悬浮控制条 = 玻璃拟态 pill(stage 底部中央、浮遊)───────────────── */
      .shell--dh .dh-panel { position: relative; }
      .shell--dh .dh-controls {
        position: absolute !important;
        left: 50%; bottom: 16px; transform: translateX(-50%);
        border-top: 0 !important;
        background: rgba(23, 17, 32, .62) !important;
        backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        border: 1px solid var(--ink-line) !important;
        border-radius: 999px !important;
        padding: 8px 12px !important;
        box-shadow: 0 12px 34px -14px rgba(0, 0, 0, .8);
        z-index: 25;
        transition: opacity .25s var(--ease-out, ease), transform .25s var(--ease-out, ease);
      }
      .shell--dh.controls-hidden .dh-controls {
        opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(12px);
      }
      /* pill 内ボタン = brand。既定は暗ガラスチップ、激活/primary は暖グラデ */
      .shell--dh .dh-btn {
        border-color: var(--ink-line) !important;
        background: rgba(32, 24, 46, .8) !important;
        color: var(--tx) !important;
      }
      .shell--dh .dh-btn:not(.active):not(.primary):not(.danger):hover {
        background: rgba(240, 117, 155, .14) !important; border-color: rgba(240, 117, 155, .45) !important;
      }
      .shell--dh .dh-btn.active {
        background: var(--grad-warm) !important; border-color: transparent !important; color: #1a0f12 !important;
      }
      .shell--dh .dh-btn.primary {
        background: var(--grad-warm) !important; border-color: transparent !important; color: #1a0f12 !important;
      }
      .shell--dh .dh-btn.primary:hover { filter: brightness(1.06); box-shadow: 0 8px 22px -8px rgba(240, 117, 155, .6) !important; }
      .shell--dh .dh-btn.danger {
        background: rgba(240, 117, 155, .16) !important; border-color: rgba(240, 117, 155, .45) !important; color: #FF9DBB !important;
      }
      .shell--dh .dh-thinking-badge { background: var(--grad-warm) !important; color: #1a0f12 !important; }

      /* ── 悬浮の切替コントロール(任务面板ボタン / 控制条把手)────────────── */
      .dh-float-btn {
        position: absolute; z-index: 30;
        display: inline-flex; align-items: center; justify-content: center;
        width: 38px; height: 38px; padding: 0; cursor: pointer;
        border-radius: 12px; border: 1px solid var(--ink-line);
        background: rgba(23, 17, 32, .7);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        color: var(--tx-mut);
        transition: color .15s, background .15s, border-color .15s, transform .15s;
      }
      .dh-float-btn:hover { color: var(--tx); border-color: rgba(240, 117, 155, .5); background: rgba(240, 117, 155, .14); }
      .dh-float-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(240, 117, 155, .35); }
      /* 任务面板切替: stage 右上(全屏フルスクリーンボタンの左隣) */
      .dh-task-toggle { top: 10px; right: 44px; }
      .shell--dh.task-open .dh-task-toggle { color: #1a0f12; background: var(--grad-warm); border-color: transparent; }
      /* 控制条把手: stage 右下(控制条隠し時に再表示する) */
      .dh-controls-handle { right: 12px; bottom: 16px; width: 34px; height: 34px; }
      .shell--dh:not(.controls-hidden) .dh-controls-handle .chev-ic { transform: rotate(180deg); }
      .dh-controls-handle .chev-ic { transition: transform .2s; display: inline-flex; }

      /* ── 沉浸(全屏)モード: 語音「全屏显示数字人」= stage を全画面化し、秘书面板/
         控制条/悬浮ボタンを隠す(browser fullscreen は gesture 必須のため CSS で代替)── */
      .shell--dh.dh-immersive .panel-secretary {
        flex: 0 0 0 !important; max-width: 0 !important; min-width: 0 !important;
        opacity: 0 !important; pointer-events: none !important;
      }
      .shell--dh.dh-immersive .dh-controls,
      .shell--dh.dh-immersive .dh-float-btn,
      .shell--dh.dh-immersive .panel-fullscreen-btn {
        opacity: 0 !important; pointer-events: none !important;
      }
      @media (max-width: 1023px) {
        .shell--dh.dh-immersive .panel-secretary { transform: translateY(102%) !important; }
      }

      /* ════════════════════════════════════════════════════════════════════
         §4.5 PC(≥1024): 左 stage + 右サイドバー面板。既定は隠す、.task-open で滑入
         ════════════════════════════════════════════════════════════════════ */
      .shell--dh .layout-split .panel-dh { flex: 1 1 auto !important; }
      .shell--dh .panel-secretary {
        border-left: 1px solid var(--ink-line);
      }
      @media (min-width: 1024px) {
        .shell--dh .layout-split .panel-secretary {
          flex: 0 0 0 !important; max-width: 0 !important; min-width: 0 !important;
          opacity: 0; pointer-events: none;
          transition: flex .3s var(--ease-out, ease), max-width .3s var(--ease-out, ease), opacity .2s ease;
        }
        /* 黄金分割: 视频区 61.8% / 任务面板 38.2%(ユーザ要望 2026-07-05)。
           panel-dh は flex:1 1 auto なので、面板を 38.2% 固定にすれば動画は残り 61.8%。 */
        .shell--dh.task-open .layout-split .panel-secretary {
          flex: 0 0 38.2% !important;
          max-width: 38.2% !important; min-width: 360px !important;
          opacity: 1; pointer-events: auto;
        }
      }

      /* ════════════════════════════════════════════════════════════════════
         §4.5 手机(<1024): 全屏 stage + 底部 sheet 面板(既定隠し / .task-open 弾出)
         + 控制条 safe-area 避け。orientation クラスに依らず幅で分岐。
         ════════════════════════════════════════════════════════════════════ */
      @media (max-width: 1023px) {
        /* stage を全屏に(上下均分を廃し、面板はオーバーレイ sheet 化)*/
        .shell--dh .main-container { position: relative; }
        .shell--dh .panel-dh {
          flex: 1 1 auto !important; min-height: 0 !important; border: 0 !important;
        }
        /* 面板 = 底部 sheet(既定は画面外へ)*/
        .shell--dh .panel-secretary {
          position: absolute !important; left: 0; right: 0; bottom: 0;
          height: min(82vh, 640px) !important; max-width: none !important;
          flex: none !important; z-index: 45;
          border-left: 0; border-top: 1px solid var(--ink-line);
          border-radius: 18px 18px 0 0;
          background: var(--ink-2);
          box-shadow: 0 -18px 44px -18px rgba(0, 0, 0, .8);
          transform: translateY(102%);
          transition: transform .32s var(--ease-out, cubic-bezier(.22,.61,.36,1));
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .shell--dh.task-open .panel-secretary { transform: translateY(0); }
        /* sheet ハンドル(上部つまみ)*/
        .shell--dh .panel-secretary::before {
          content: ""; position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
          width: 40px; height: 4px; border-radius: 999px; background: var(--ink-line); z-index: 2;
        }
        /* sheet 背後の暗幕(タップで閉じる)*/
        .dh-sheet-backdrop {
          position: absolute; inset: 0; z-index: 44; background: rgba(6, 4, 10, .5);
          opacity: 0; pointer-events: none; transition: opacity .28s ease;
        }
        .shell--dh.task-open .dh-sheet-backdrop { opacity: 1; pointer-events: auto; }
        /* 控制条は下部・safe-area 回避 */
        .shell--dh .dh-controls {
          bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
          max-width: calc(100vw - 24px); flex-wrap: wrap; justify-content: center;
        }
        .dh-controls-handle { bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
        /* 任务ボタンは手机でも右上 */
        .dh-task-toggle { top: calc(10px + env(safe-area-inset-top, 0px)); }
      }
      @media (min-width: 1024px) {
        .dh-sheet-backdrop { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        .shell--dh .panel-secretary, .shell--dh .dh-controls { transition: none !important; }
      }
    </style>
    <div class="shell shell--chat shell--v3 shell--secretary">

      <div class=${containerClasses} role="main">
        <!-- ── Left / top: Digital Human panel ───────────────────────────── -->
        <section
          class="panel-dh"
          aria-label=${t("dh.panelLabel")}
          @dblclick=${(e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest("video")) {
              toggleBrowserFullscreen(".panel-dh");
            }
          }}
        >
          ${renderDHFullscreenToggle(state)}

          <!-- §4.1 任务管理 切替(悬浮・右上)。ボタン + ui_action(task_panel) 双通道 -->
          <button
            class="dh-float-btn dh-task-toggle"
            @click=${() => toggleTaskPanel()}
            title=${t("chat.panelLabel")}
            aria-label=${t("chat.panelLabel")}
          >
            ${iconPanelToggle()}
          </button>

          ${renderDigitalHumanPanel(state.dhPanel)}

          <!-- §4.2 控制条 表示/隐藏 把手(悬浮・右下)。ボタン + ui_action(controls) 双通道 -->
          <button
            class="dh-float-btn dh-controls-handle"
            @click=${() => toggleControls()}
            title=${t("dh.controlsLabel")}
            aria-label=${t("dh.controlsLabel")}
          >
            <span class="chev-ic">${iconControlsHandle()}</span>
          </button>
        </section>

        <!-- 手机 sheet 背後の暗幕(タップで閉じる) -->
        <div class="dh-sheet-backdrop" @click=${() => setTaskPanelOpen(false)} aria-hidden="true"></div>

        <!-- ── Right / bottom: 秘书面板(docs/10 §4.2 右区 3 段) ──────────── -->
        <section class="panel-chat panel-secretary" aria-label=${t("chat.panelLabel")}>
          <secretary-panel
            .aimetaToken=${state.aimetaToken ?? null}
            .aimetaApi=${state.aimetaApi ?? null}
            .subtitle=${state.dhPanel.currentSubtitle ?? null}
          ></secretary-panel>
        </section>
      </div>

      <!-- Status bar is rendered by the host component (renderStatusBar) -->
    </div>
  `;
}
