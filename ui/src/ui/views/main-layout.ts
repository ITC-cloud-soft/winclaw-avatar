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
 * Fullscreen toggle button for the DH panel.
 * Shown in the top-right corner of the panel when hovering or focused.
 */
function renderDHFullscreenToggle(state: MainLayoutState) {
  const isDHFull = state.layoutMode === "dh-fullscreen";
  const label = t(isDHFull ? "layout.exitFullscreen" : "layout.dhFullscreen");

  return html`
    <button
      class="panel-fullscreen-btn"
      @click=${() =>
        state.onSetLayoutMode(isDHFull ? "split" : "dh-fullscreen")}
      title=${label}
      aria-label=${label}
    >
      ${isDHFull ? iconCompress() : iconExpand()}
    </button>
  `;
}

/**
 * Fullscreen toggle button for the chat panel.
 */
function renderChatFullscreenToggle(state: MainLayoutState) {
  const isChatFull = state.layoutMode === "chat-fullscreen";
  const label = t(isChatFull ? "layout.exitFullscreen" : "layout.chatFullscreen");

  return html`
    <button
      class="panel-fullscreen-btn"
      @click=${() =>
        state.onSetLayoutMode(isChatFull ? "split" : "chat-fullscreen")}
      title=${label}
      aria-label=${label}
    >
      ${isChatFull ? iconCompress() : iconExpand()}
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

  return html`
    <div class="shell shell--chat shell--v3">
      ${renderTopbarV3(state)}

      <div class=${containerClasses} role="main">
        <!-- ── Left / top: Digital Human panel ───────────────────────────── -->
        <section
          class="panel-dh"
          aria-label=${t("dh.panelLabel")}
          @dblclick=${(e: MouseEvent) => {
            // Double-click anywhere in the DH panel (outside the video — that
            // has its own dblclick on the <video> element) also triggers fullscreen
            const target = e.target as HTMLElement;
            if (!target.closest("video")) {
              state.onSetLayoutMode(
                state.layoutMode === "dh-fullscreen" ? "split" : "dh-fullscreen",
              );
            }
          }}
        >
          ${renderDHFullscreenToggle(state)}
          ${renderDigitalHumanPanel(state.dhPanel)}
        </section>

        <!-- ── Right / bottom: Chat panel ───────────────────────────────── -->
        <section
          class="panel-chat"
          aria-label=${t("chat.panelLabel")}
        >
          ${renderChatFullscreenToggle(state)}
          ${renderChat(state.chatPanel)}
        </section>
      </div>

      <!-- Status bar is rendered by the host component (renderStatusBar) -->
    </div>
  `;
}
