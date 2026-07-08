/**
 * digital-human.ts
 *
 * Lit render function for the Digital Human panel (left side of the split-screen
 * layout). This module is intentionally side-effect free: it exports pure
 * functions and a state interface. Actual ByteRTC stream wiring, microphone
 * capture, and WebSocket management live in the extension layer.
 */

import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";

// ---------------------------------------------------------------------------
// Qwen realtime voice catalog (client mirror)
// ---------------------------------------------------------------------------

/**
 * Curated Qwen 3.5 realtime voices offered in the in-page selector. Ids MUST
 * match the server catalog (`docker/overlay-secui/dh-src/integrations/qwen-voices.ts`)
 * so the `voice_change` command the browser sends validates on the node side.
 * Grouped by gender for the dropdown; `Serena` is the DashScope default.
 */
export interface DHVoiceOption {
  /** Voice id sent in `voice_change` (must exist in the server catalog). */
  id: string;
  /** Label shown in the dropdown. */
  label: string;
  gender: "female" | "male";
}

/** Female + male Qwen voices exposed in the DH panel selector. */
export const DH_VOICE_OPTIONS: ReadonlyArray<DHVoiceOption> = [
  // 女声 (female)
  { id: "Serena", label: "Serena · 温暖 (默认)", gender: "female" },
  { id: "Cherry", label: "Cherry · 年轻", gender: "female" },
  { id: "Chelsie", label: "Chelsie · 明亮", gender: "female" },
  { id: "Bella", label: "Bella · EN♀", gender: "female" },
  { id: "Aria", label: "Aria · EN♀ 明亮", gender: "female" },
  // 男声 (male)
  { id: "Ethan", label: "Ethan · 沉稳", gender: "male" },
  { id: "River", label: "River · 浑厚", gender: "male" },
  { id: "Cove", label: "Cove · 冷静", gender: "male" },
  { id: "Daniel", label: "Daniel · EN♂ 专业", gender: "male" },
  { id: "Frank", label: "Frank · EN♂ 低沉", gender: "male" },
];

/** Default Qwen voice (mirrors server `DEFAULT_VOICE`). */
export const DH_DEFAULT_VOICE = "Serena";

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

/** Connection / session lifecycle state for the DH panel */
export type DHConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface DHPanelState {
  // ── Session state ────────────────────────────────────────────────────────
  /** Whether the ByteRTC session is active and the video stream is live */
  isConnected: boolean;
  /** Coarser lifecycle label used for status badge display */
  connectionStatus: DHConnectionStatus;
  /** Error message to display when connectionStatus === 'error' */
  errorMessage: string | null;

  // ── Media controls ───────────────────────────────────────────────────────
  /** Microphone active (default: true when session is live) */
  micEnabled: boolean;
  /** Camera / PiP preview active (default: false) */
  cameraEnabled: boolean;

  // ── Subtitles ────────────────────────────────────────────────────────────
  /** Whether the subtitle bar is expanded */
  subtitleVisible: boolean;
  /** Current AI speech text displayed as subtitle */
  currentSubtitle: string;

  // ── Callbacks ────────────────────────────────────────────────────────────
  /** Called when the user clicks the "Start Session" button or the placeholder */
  onStart: () => void;
  /** Called when the user clicks the "End Session" button */
  onStop: () => void;
  /** Whether the digital-human avatar (MuseTalk) is currently shown. Independent of the Qwen voice session. */
  avatarActive: boolean;
  /** Toggle the avatar on/off. Does NOT stop the Qwen voice conversation. */
  onToggleAvatar: () => void;
  /** Called when the mic toggle button is clicked */
  onToggleMic: () => void;
  /** Called when the camera toggle button is clicked */
  onToggleCamera: () => void;
  /** Called when the subtitle collapse button is toggled */
  onToggleSubtitle: () => void;
  /** Called when the user double-clicks the video area (triggers DH fullscreen) */
  onVideoDoubleClick: () => void;

  // ── Thinking indicator ──────────────────────────────────────────────────
  /** Whether the agent is currently processing */
  isThinking: boolean;

  // ── Voice selector ──────────────────────────────────────────────────────
  /** Currently selected voice ID */
  selectedVoice: string;
  /** Called when user changes the voice dropdown */
  onVoiceChange: (voiceId: string) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function renderConnectionBadge(status: DHConnectionStatus) {
  if (status === "disconnected") return nothing;

  const labelKey =
    status === "connecting"
      ? "dh.statusConnecting"
      : status === "connected"
        ? "dh.statusConnected"
        : "dh.statusError";

  return html`
    <span class="dh-status-badge dh-status-badge--${status}" role="status">
      ${t(labelKey)}
    </span>
  `;
}

function renderPlaceholder(onStart: () => void) {
  return html`
    <div
      class="dh-placeholder"
      @click=${onStart}
      role="button"
      tabindex="0"
      aria-label=${t("dh.clickToStart")}
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStart();
        }
      }}
    >
      <img
        src="/avatar-placeholder.png"
        class="dh-avatar-static"
        alt=${t("dh.avatarAlt")}
      />
      <span class="dh-start-hint">${t("dh.clickToStart")}</span>
    </div>
  `;
}

function renderVideoArea(state: DHPanelState) {
  if (!state.isConnected) {
    return renderPlaceholder(state.onStart);
  }
  return html`
    <div
      id="dh-video-player"
      class="dh-video-player-container"
      @dblclick=${state.onVideoDoubleClick}
      aria-label=${t("dh.videoLabel")}
    ></div>
  `;
}

function renderCameraPip(cameraEnabled: boolean) {
  if (!cameraEnabled) return nothing;
  return html`
    <video
      id="camera-preview"
      class="camera-pip"
      autoplay
      playsinline
      muted
      aria-label=${t("dh.cameraPreviewLabel")}
    ></video>
  `;
}

// renderSubtitle は削除（ユーザ要望 2026-07-07: 内嵌数字人画面の下方字幕を非表示）。
// 字幕 state(dhSubtitleVisible/dhCurrentSubtitle)と onSubtitleUpdate は残すが UI には出さない。

function renderMicIcon(enabled: boolean) {
  return enabled
    ? html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>`
    : html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>`;
}

function renderCameraIcon(enabled: boolean) {
  return enabled
    ? html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
        <path d="M23 7 16 12 23 17V7z"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>`
    : html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"/>
        <path d="M23 7l-7 5 7 5V7z"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>`;
}

function renderControls(state: DHPanelState) {
  const micLabel = t(state.micEnabled ? "dh.micOn" : "dh.micOff");
  const camLabel = t(state.cameraEnabled ? "dh.camOn" : "dh.camOff");

  // Sprint D §4.4: 控制条は main-layout の brand 换肤(玻璃 pill + 激活态渐变)を
  // 受ける。dh-controls--brand は brand テーマ適用済みの目印(将来のフック用)。
  // 既存の .dh-controls / .dh-btn.active|primary|danger 構造は不変(保功能)。
  return html`
    <div class="dh-controls dh-controls--brand" role="toolbar" aria-label=${t("dh.controlsLabel")}>
      <!-- Mic toggle -->
      <button
        class="dh-btn ${state.micEnabled ? "active" : "inactive"}"
        @click=${state.onToggleMic}
        title=${micLabel}
        aria-pressed=${state.micEnabled ? "true" : "false"}
        aria-label=${micLabel}
      >
        ${renderMicIcon(state.micEnabled)}
        <span class="dh-btn-label">${micLabel}</span>
      </button>

      <!-- Camera toggle -->
      <button
        class="dh-btn ${state.cameraEnabled ? "active" : "inactive"}"
        @click=${state.onToggleCamera}
        title=${camLabel}
        aria-pressed=${state.cameraEnabled ? "true" : "false"}
        aria-label=${camLabel}
      >
        ${renderCameraIcon(state.cameraEnabled)}
        <span class="dh-btn-label">${camLabel}</span>
      </button>

      <!-- 声音选择は伴侣管理画面(ai-meta)へ移設したため内嵌控制条からは削除。
           声音切替の実体(voice_change WS / reconnectWithVoice)は残置(将来再利用可)。 -->

      <!-- 数字人形象 ON/OFF(Qwen 音声対話は常時維持。このボタンは avatar のみを制御) -->
      ${state.isConnected
        ? html`
            <button
              class="dh-btn ${state.avatarActive ? "danger" : "primary"}"
              @click=${state.onToggleAvatar}
              aria-pressed=${state.avatarActive ? "true" : "false"}
              aria-label=${t(state.avatarActive ? "dh.avatarStop" : "dh.avatarStart")}
              title=${t(state.avatarActive ? "dh.avatarStop" : "dh.avatarStart")}
            >
              ${state.avatarActive
                ? html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  </svg>`
                : html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
                    <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/>
                    <path d="M3 22a9 9 0 0 1 18 0"/>
                  </svg>`}
              <span class="dh-btn-label">${t(state.avatarActive ? "dh.avatarStop" : "dh.avatarStart")}</span>
            </button>
          `
        : html`
            <button
              class="dh-btn primary"
              @click=${state.onStart}
              aria-label=${t("dh.startSession")}
              ?disabled=${state.connectionStatus === "connecting"}
            >
              ${state.connectionStatus === "connecting"
                ? html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`
                : html`<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="currentColor" stroke-width="0"><polygon points="5 3 19 12 5 21 5 3"/></svg>`}
              <span class="dh-btn-label">
                ${state.connectionStatus === "connecting"
                  ? t("dh.statusConnecting")
                  : t("dh.startSession")}
              </span>
            </button>
          `}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Public render function
// ---------------------------------------------------------------------------

/**
 * Renders the complete digital human panel.
 *
 * The caller is responsible for attaching this to the DOM inside a Lit
 * host component (typically `WinClawApp` or a dedicated layout component).
 * The `<video id="dh-video-player">` element must be referenced externally
 * to attach the ByteRTC MediaStream once the session is established.
 */
export function renderDigitalHumanPanel(state: DHPanelState) {
  return html`
    <div class="dh-panel" aria-label=${t("dh.panelLabel")}>

      <!-- Video / placeholder area -->
      <div class="dh-video-container">
        ${renderConnectionBadge(state.connectionStatus)}
        ${state.isThinking ? html`<span class="dh-thinking-badge">正在思考中...</span>` : nothing}
        ${renderVideoArea(state)}
        ${renderCameraPip(state.cameraEnabled)}

        ${state.connectionStatus === "error" && state.errorMessage
          ? html`
              <div class="dh-error-overlay" role="alert">
                <span class="dh-error-text">${state.errorMessage}</span>
              </div>
            `
          : nothing}
      </div>

      <!-- Subtitle area removed (ユーザ要望 2026-07-07: 内嵌数字人画面の下方字幕を非表示) -->

      <!-- Control toolbar -->
      ${renderControls(state)}
    </div>
  `;
}
