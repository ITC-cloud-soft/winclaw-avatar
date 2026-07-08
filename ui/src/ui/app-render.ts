import { html, nothing } from "lit";
import type { AppViewState } from "./app-view-state.ts";
import type { UsageState } from "./controllers/usage.ts";
import { parseAgentSessionKey } from "../../../src/routing/session-key.js";
import { refreshChatAvatar } from "./app-chat.ts";
import { renderChatControls } from "./app-render.helpers.ts";
import { renderCommandPalette } from "./components/command-palette.ts";
import { renderSessionTabs } from "./components/session-tabs.ts";
import { loadAgentFileContent, loadAgentFiles, saveAgentFile } from "./controllers/agent-files.ts";
import { loadAgentIdentities, loadAgentIdentity } from "./controllers/agent-identity.ts";
import { loadAgentSkills } from "./controllers/agent-skills.ts";
import { loadAgents } from "./controllers/agents.ts";
import { loadChannels } from "./controllers/channels.ts";
import { loadChatHistory } from "./controllers/chat.ts";
import {
  applyConfig,
  loadConfig,
  runUpdate,
  saveConfig,
  updateConfigFormValue,
  removeConfigFormValue,
} from "./controllers/config.ts";
import {
  loadCronRuns,
  toggleCronJob,
  runCronJob,
  removeCronJob,
  addCronJob,
} from "./controllers/cron.ts";
import { loadDebug, callDebugMethod } from "./controllers/debug.ts";
import {
  approveDevicePairing,
  loadDevices,
  rejectDevicePairing,
  revokeDeviceToken,
  rotateDeviceToken,
} from "./controllers/devices.ts";
import {
  loadExecApprovals,
  removeExecApprovalsFormValue,
  saveExecApprovals,
  updateExecApprovalsFormValue,
} from "./controllers/exec-approvals.ts";
import { loadLogs } from "./controllers/logs.ts";
import { loadNodes } from "./controllers/nodes.ts";
import { loadPresence } from "./controllers/presence.ts";
import { deleteSession, loadSessions, patchSession } from "./controllers/sessions.ts";
import {
  installSkill,
  loadSkills,
  saveSkillApiKey,
  updateSkillEdit,
  updateSkillEnabled,
} from "./controllers/skills.ts";
import { loadUsage, loadSessionTimeSeries, loadSessionLogs } from "./controllers/usage.ts";
import { DHSessionController } from "./dh-session-controller.ts";
import { DH_DEFAULT_VOICE } from "./views/digital-human.ts";
import { icons } from "./icons.ts";
import { COMMANDS, normalizeBasePath, subtitleForTab, titleForTab } from "./navigation.ts";
import { generateUUID } from "./uuid.ts";

// Module-scope debounce for usage date changes (avoids type-unsafe hacks on state object)
let usageDateDebounceTimeout: number | null = null;
const debouncedLoadUsage = (state: UsageState) => {
  if (usageDateDebounceTimeout) {
    clearTimeout(usageDateDebounceTimeout);
  }
  usageDateDebounceTimeout = window.setTimeout(() => void loadUsage(state), 400);
};
import { renderAgents } from "./views/agents.ts";
import { renderChannels } from "./views/channels.ts";
import { renderChat } from "./views/chat.ts";
import { renderConfig } from "./views/config.ts";
import { renderCron } from "./views/cron.ts";
import { renderDebug } from "./views/debug.ts";
import { renderExecApprovalPrompt } from "./views/exec-approval.ts";
import { renderGatewayUrlConfirmation } from "./views/gateway-url-confirmation.ts";
import { renderInstances } from "./views/instances.ts";
import { renderLogs } from "./views/logs.ts";
import { renderNodes } from "./views/nodes.ts";
import { renderOverview } from "./views/overview.ts";
import { renderPersonalInfo } from "./views/personal-info.ts";
import { renderMainLayout } from "./views/main-layout.ts";
import type { MainLayoutState, LayoutMode } from "./views/main-layout.ts";
import { renderLanguageSelector } from "./components/language-selector.ts";
import { loadPersonalInfo, savePersonalInfo, updatePersonalInfoField } from "./controllers/personal-info.ts";
import { renderSessions } from "./views/sessions.ts";
import { renderSkills } from "./views/skills.ts";
import { renderUsage } from "./views/usage.ts";

const AVATAR_DATA_RE = /^data:/i;
const AVATAR_HTTP_RE = /^https?:\/\//i;

/**
 * Detail carried by the `dh-ui-action` DOM event (dispatched by
 * `dh-websocket.ts` when Qwen calls the `ui_action` tool). Sprint D voice UI
 * control — see `docs/dh-voice-control-everything-plan.md` §3.
 */
interface DhUiActionDetail {
  target: string;
  action: string;
  name?: string;
}

/** True once the module-level `dh-ui-action` listener has been bound. */
let dhUiActionListenerBound = false;

/**
 * Bind a one-shot `window` listener that turns a `dh-ui-action` event into the
 * matching existing UI behaviour. Registered lazily from {@link renderApp} so
 * it captures a live {@link AppViewState}; the {@link dhUiActionListenerBound}
 * guard keeps re-renders from stacking duplicate listeners.
 *
 * Dispatch table (target → existing handler / state):
 *   - artifact   → re-dispatch `dh-ui-artifact` ({name}) for the secretary panel
 *   - task_panel → toggle `state.dhTaskPanelOpen`
 *   - controls   → toggle `state.dhControlsVisible`
 *   - mic        → controller mic toggle (mirrors `onToggleMic`)
 *   - camera     → controller camera toggle (mirrors `onToggleCamera`)
 *   - avatar     → controller `toggleAvatar` (mirrors `onToggleAvatar`)
 */
function ensureDhUiActionListener(state: AppViewState): void {
  if (dhUiActionListenerBound) return;
  dhUiActionListenerBound = true;

  window.addEventListener("dh-ui-action", (ev: Event) => {
    const detail = (ev as CustomEvent<DhUiActionDetail>).detail;
    if (!detail || typeof detail.target !== "string") return;
    const { target, action, name } = detail;

    // `hide`/`close`/`off` force the closed/off state; `show`/`open`/`on`
    // force open/on; `toggle` (or anything else) flips. Devices (mic/camera/
    // avatar) reuse the controller's own toggle, so we only translate the
    // explicit on/off intents where the controller exposes a plain toggle.
    const wantsClose = action === "hide" || action === "close" || action === "off";
    const wantsOpen = action === "show" || action === "open" || action === "on";

    // ★职责拆分(修 medium: 双 listener 重叠): app-render **只**负责需要 controller
    // 的设备类 mic/camera/avatar。artifact/task_panel/controls 由 main-layout 的
    // dh-ui-action listener 独占(CSS 类切换才真正生效;artifact 只 dispatch 一次)。
    // 避免 artifact 双触发 + task_panel/controls 的死 state 写入。
    switch (target) {
      case "mic": {
        toggleDhMic(state, wantsClose ? false : wantsOpen ? true : undefined);
        break;
      }
      case "camera": {
        toggleDhCamera(state, wantsClose ? false : wantsOpen ? true : undefined);
        break;
      }
      case "avatar": {
        toggleDhAvatar(state, wantsClose ? false : wantsOpen ? true : undefined);
        break;
      }
      case "subtitle": {
        // 字幕(dh-subtitle)の展開/折畳。state 駆動(Lit 再レンダで class 反映)。
        state.dhSubtitleVisible = wantsClose ? false : wantsOpen ? true : !(state.dhSubtitleVisible ?? true);
        break;
      }
      case "voice": {
        // 音色切替。name に話者/特徴/言語(例「活泼」「日語」「小夏」)を載せる。
        if (name) setDhVoice(state, name);
        break;
      }
      case "task_continue": {
        // 特定タスク番号への継続指示。name = JSON {seq, text}。secretary-panel が
        // 該当タスクを user_seq で解決し POST /tasks/{id}/messages する。
        if (name) {
          window.dispatchEvent(
            new CustomEvent("dh-ui-task-continue", { detail: { payload: name } }),
          );
        }
        break;
      }
      case "task_artifact": {
        // 特定タスク番号の成果物を開く。name = JSON {seq, query}。secretary-panel が
        // 該当タスクを解決→artifacts 取得→query で選び openPreview する。
        if (name) {
          window.dispatchEvent(
            new CustomEvent("dh-ui-task-artifact", { detail: { payload: name } }),
          );
        }
        break;
      }
      case "music": {
        // 語音点歌(内蔵 music bundle・docs/20)。action=play(name=JSON{playUrl,
        // title,artist,cover,loop})/pause/stop。secretary-panel の音乐カードが受けて
        // <audio> を制御する。疎結合に DOM イベントで流す。
        window.dispatchEvent(
          new CustomEvent("dh-ui-music", { detail: { action, payload: name } }),
        );
        break;
      }
      // artifact / task_panel / controls / fullscreen: main-layout が担当(此処では無視)。
      case "artifact":
      case "task_panel":
      case "controls":
      case "fullscreen":
        break;
      default:
        console.debug("[dh-ui-action] Unknown target:", target);
        break;
    }
  });
}

/**
 * Toggle the DH microphone via the live controller (mirrors the `onToggleMic`
 * render handler). When `want` is provided, only acts if the current state
 * differs, so `on`/`off` are idempotent; when omitted, always flips.
 */
function toggleDhMic(state: AppViewState, want?: boolean): void {
  const cur = state.dhMicEnabled ?? false;
  if (want !== undefined && want === cur) return;
  const next = !cur;
  state.dhMicEnabled = next;
  try {
    const win = window as unknown as Record<string, unknown>;
    const ctrl = win.__dhController as Record<string, unknown> | null;
    if (ctrl) {
      for (const val of Object.values(ctrl)) {
        if (val && typeof val === "object" && "setMuted" in (val as Record<string, unknown>)) {
          (val as { setMuted: (m: boolean) => void }).setMuted(!next);
          break;
        }
      }
    }
  } catch (e) {
    console.error("[Mic] Voice-action toggle error:", e);
  }
}

/**
 * Toggle the DH camera via the live controller (mirrors `onToggleCamera`).
 * Idempotent when `want` is provided.
 */
function toggleDhCamera(state: AppViewState, want?: boolean): void {
  const cur = state.dhCameraEnabled ?? false;
  if (want !== undefined && want === cur) return;
  try {
    const win = window as unknown as Record<string, unknown>;
    const ctrl = win.__dhController as { toggleCamera?: () => boolean } | null;
    if (!ctrl || typeof ctrl.toggleCamera !== "function") {
      console.warn("[Camera] Controller not ready — start a DH session first");
      return;
    }
    state.dhCameraEnabled = ctrl.toggleCamera();
  } catch (err) {
    console.error("[Camera] Voice-action toggle failed:", err);
    state.dhCameraEnabled = false;
  }
}

/**
 * Toggle the DH avatar (数字人形象) via the live controller (mirrors
 * `onToggleAvatar`). Idempotent when `want` is provided so voice `on`/`off`
 * don't double-flip when both the deterministic fallback and Qwen fire.
 */
function toggleDhAvatar(state: AppViewState, want?: boolean): void {
  const cur = state.dhAvatarActive ?? false;
  if (want !== undefined && want === cur) return;
  const win = window as unknown as Record<string, unknown>;
  const ctrl = win.__dhController as { toggleAvatar?: () => boolean } | null;
  if (!ctrl || typeof ctrl.toggleAvatar !== "function") {
    console.warn("[Avatar] Controller not ready — Qwen セッション未接続");
    return;
  }
  state.dhAvatarActive = ctrl.toggleAvatar();
}

/**
 * 語音の音色名 → Qwen realtime voiceId 対応。控制条ドロップダウン(digital-human.ts の
 * {@link DH_VOICE_OPTIONS})と同じ Qwen 音色に当てる。話者名(Serena/Ethan)・
 * 特徴(温柔/沉稳)・性別(女声/男声)・言語(英語)いずれの言い方でも当たるよう各 id に
 * 別名群を持たせる(性別だけ言われた時は既定の女声/男声に寄せる)。
 */
const DH_VOICE_ALIASES: ReadonlyArray<{ id: string; alias: RegExp }> = [
  // 女声 (female)
  { id: "Cherry", alias: /cherry|年轻|年輕|活泼|活潑/i },
  { id: "Chelsie", alias: /chelsie|明亮/i },
  { id: "Bella", alias: /bella/i },
  { id: "Aria", alias: /aria/i },
  // 「女声/温柔/默认」など汎称は既定女声 Serena に寄せる(最後に総括で拾う)
  { id: "Serena", alias: /serena|温柔|溫柔|温暖|溫暖|默认|默認|女声|女聲|女性|female/i },
  // 男声 (male)
  { id: "River", alias: /river|浑厚|渾厚/i },
  { id: "Cove", alias: /cove|冷静|冷靜/i },
  { id: "Daniel", alias: /daniel/i },
  { id: "Frank", alias: /frank|低沉/i },
  // 「男声/沉稳」など汎称は既定男声 Ethan に寄せる
  { id: "Ethan", alias: /ethan|沉稳|沉穩|男声|男聲|男性|male/i },
];

/**
 * 語音での音色切替(control-bar のドロップダウンと同一の副作用 = Tier 2 実時再接続)。
 * 認識した Qwen 音色 id を state/window に記録し、生きている DH controller があれば
 * `setVoice` で `voice_change` を送って realtime を張り直す(次の一句から新声)。
 */
function setDhVoice(state: AppViewState, spoken: string): void {
  const hit = DH_VOICE_ALIASES.find((v) => v.alias.test(spoken));
  if (!hit) {
    console.debug("[Voice] no voice matched for:", spoken);
    return;
  }
  (state as unknown as Record<string, string>).dhSelectedVoice = hit.id;
  (window as unknown as Record<string, unknown>).__dhSelectedVoice = hit.id;
  const ctrl = (window as unknown as Record<string, unknown>).__dhController as
    | { setVoice?: (v: string) => boolean }
    | null;
  if (ctrl && typeof ctrl.setVoice === "function") {
    ctrl.setVoice(hit.id);
  }
  console.info("[Voice] Voice-action set voice:", hit.id);
}

/** Create a new chat session with a unique UUID-based key and add it to open tabs. */
async function createNewChatSession(state: AppViewState) {
  const parsed = parseAgentSessionKey(state.sessionKey);
  const agentId = parsed?.agentId ?? "main";
  const newKey = `agent:${agentId}:${generateUUID()}`;

  // Add to open sessions
  state.addChatSession(newKey);

  // Clear chat UI for instant feedback
  state.chatMessages = [];
  state.chatToolMessages = [];
  state.chatStream = null;
  state.chatStreamStartedAt = null;
  state.chatRunId = null;
  state.chatQueue = [];
  state.chatMessage = "";
  state.chatAttachments = [];
  state.resetToolStream();
  state.resetChatScroll();

  // Switch to the new session
  state.sessionKey = newKey;
  state.applySettings({
    ...state.settings,
    sessionKey: newKey,
    lastActiveSessionKey: newKey,
    openChatSessions: state.openChatSessions,
  });

  void state.loadAssistantIdentity();
  await loadChatHistory(state);
  void refreshChatAvatar(state);
}

function resolveAssistantAvatarUrl(state: AppViewState): string | undefined {
  const list = state.agentsList?.agents ?? [];
  const parsed = parseAgentSessionKey(state.sessionKey);
  const agentId = parsed?.agentId ?? state.agentsList?.defaultId ?? "main";
  const agent = list.find((entry) => entry.id === agentId);
  const identity = agent?.identity;
  const candidate = identity?.avatarUrl ?? identity?.avatar;
  if (!candidate) {
    return undefined;
  }
  if (AVATAR_DATA_RE.test(candidate) || AVATAR_HTTP_RE.test(candidate)) {
    return candidate;
  }
  return identity?.avatarUrl;
}

/**
 * Construct the MainLayoutState from AppViewState for the digital-human tab.
 * The DH panel is in a "disconnected" stub state until real WS integration.
 */
function buildMainLayoutState(
  state: AppViewState,
  onNewSession: () => void,
): MainLayoutState {
  const assistantAvatarUrl = resolveAssistantAvatarUrl(state);
  const chatAvatarUrl = state.chatAvatarUrl ?? assistantAvatarUrl ?? null;
  const chatDisabledReason = state.connected ? null : "Disconnected from gateway.";
  const showThinking = state.onboarding ? false : state.settings.chatShowThinking;

  return {
    layoutMode: (state.dhLayoutMode ?? "split") as LayoutMode,
    orientation: window.innerWidth >= 768 ? "landscape" : "portrait",
    assistantName: state.assistantName ?? "WinClaw",
    dhOnline: state.dhConnectionStatus === "connected",
    basePath: state.basePath ?? "",
    // 数字人秘书 A案 身份桥(docs/10 §14.5): settings 経由で秘书パネルへ。空文字は無効(null)。
    aimetaToken: state.settings.aimetaToken || null,
    aimetaApi: state.settings.aimetaApi || null,
    onSetLayoutMode: (mode) => {
      state.dhLayoutMode = mode;
    },
    onOpenSettings: () => state.openTabFromPalette("config"),
    onToggleTheme: () => {
      const next = state.themeResolved === "dark" ? "light" : "dark";
      state.setTheme(next as import("./theme.ts").ThemeMode);
    },
    dhPanel: {
      isConnected: state.dhConnectionStatus === "connected",
      connectionStatus: state.dhConnectionStatus ?? "disconnected",
      errorMessage: state.dhErrorMessage ?? null,
      micEnabled: state.dhMicEnabled ?? false,
      cameraEnabled: state.dhCameraEnabled ?? false,
      subtitleVisible: state.dhSubtitleVisible ?? true,
      isThinking: state.dhIsThinking ?? false,
      currentSubtitle: state.dhCurrentSubtitle ?? "",
      onStart: () => {
        // Prevent double-start while connecting.
        if (state.dhConnectionStatus === "connecting" || state.dhConnectionStatus === "connected") {
          return;
        }

        state.dhConnectionStatus = "connecting";
        state.dhErrorMessage = null;

        // Discover the DH WebSocket port from the health endpoint, then
        // create a DHSessionController and start the session.
        const token = state.settings?.token ?? "";
        fetch("/api/dh/health", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then(async (res) => {
            if (!res.ok) {
              throw new Error(`DH health check failed: ${res.status} ${res.statusText}`);
            }
            const data = (await res.json()) as { wsPort?: number };
            const wsPort = data.wsPort;
            if (!wsPort) {
              throw new Error("DH health response missing wsPort");
            }

            const controller = new DHSessionController({
              onConnectionStatusChange: (status) => {
                state.dhConnectionStatus = status;
                if (status === "disconnected") {
                  state.dhCurrentSubtitle = "";
                  // Do NOT clear controller here — stop() during start() triggers this
                }
              },
              onSubtitleUpdate: (text, isDelta) => {
                if (isDelta) {
                  state.dhCurrentSubtitle = (state.dhCurrentSubtitle ?? "") + text;
                } else {
                  state.dhCurrentSubtitle = text;
                }
              },
              onErrorMessage: (message) => {
                state.dhErrorMessage = message;
              },
              onUserTranscript: (_transcript) => {
                // User transcript available for future use (e.g. chat log).
              },
              onThinkingChange: (thinking) => {
                state.dhIsThinking = thinking;
              },
              onAvatarActiveChange: (active) => {
                // avatar(数字人形象)の起動/停止状態。Qwen 対話とは独立。
                state.dhAvatarActive = active;
              },
            });

            state.dhController = controller;
            (window as unknown as Record<string, unknown>).__dhController = controller;
            console.log('[DH] Controller stored on window, starting session...');
            await controller.start(wsPort, token);
            console.log('[DH] Session started, recorder:', !!controller.recorder);

            // Re-attach camera preview if it was open before session start
            const win = window as unknown as Record<string, unknown>;
            const camStream = win.__dhCameraStream as MediaStream | null;
            if (camStream && camStream.active && state.dhCameraEnabled) {
              setTimeout(() => {
                const el = document.getElementById('camera-preview') as HTMLVideoElement | null;
                if (el && !el.srcObject) el.srcObject = camStream;
              }, 200);
            }
          })
          .catch((err: unknown) => {
            console.error("[DH] Session start failed:", err);
            state.dhConnectionStatus = "error";
            state.dhErrorMessage =
              err instanceof Error ? err.message : "Failed to start DH session";
            state.dhController = undefined;
            (window as unknown as Record<string, unknown>).__dhController = null;
          });
      },
      onStop: () => {
        const controller = state.dhController;
        state.dhCurrentSubtitle = "";
        if (controller) {
          void controller.stop();
        } else {
          state.dhConnectionStatus = "disconnected";
        }
      },
      // 数字人形象(avatar)の起動/停止のみ。Qwen 音声対話(WS+マイク)は維持する。
      avatarActive: state.dhAvatarActive ?? false,
      onToggleAvatar: () => {
        const win = window as unknown as Record<string, unknown>;
        const ctrl = win.__dhController as
          | { toggleAvatar?: () => boolean }
          | null;
        if (!ctrl || typeof ctrl.toggleAvatar !== "function") {
          console.warn("[Avatar] Controller not ready — Qwen セッション未接続");
          return;
        }
        // toggleAvatar() は意図した新状態(表示=true/停止=false)を返す。
        // 実描画は onAvatarActiveChange で確定するが、即時反映でボタンのちらつきを防ぐ。
        state.dhAvatarActive = ctrl.toggleAvatar();
      },
      onToggleMic: () => {
        const next = !(state.dhMicEnabled ?? false);
        state.dhMicEnabled = next;
        // Mute/unmute by toggling enabled on ALL active audio input tracks
        try {
          const win = window as unknown as Record<string, unknown>;
          const ctrl = win.__dhController as Record<string, unknown> | null;
          // Access recorder through any property name (survives minification)
          if (ctrl) {
            for (const val of Object.values(ctrl)) {
              if (val && typeof val === 'object' && 'setMuted' in (val as Record<string, unknown>)) {
                (val as { setMuted: (m: boolean) => void }).setMuted(!next);
                break;
              }
            }
          }
        } catch (e) {
          console.error('[Mic] Toggle error:', e);
        }
      },
      onToggleCamera: () => {
        // Delegate to the DH session controller so that turning the camera on
        // also starts VideoCapture + sends frames to Qwen via WebSocket.
        // Previously this handler managed the PiP preview independently,
        // which meant no frames ever reached the server.
        try {
          const win = window as unknown as Record<string, unknown>;
          const ctrl = win.__dhController as
            | { toggleCamera?: () => boolean }
            | null;
          if (!ctrl || typeof ctrl.toggleCamera !== 'function') {
            console.warn('[Camera] Controller not ready — start a DH session first');
            return;
          }
          const nowEnabled = ctrl.toggleCamera();
          state.dhCameraEnabled = nowEnabled;
          console.log(`[Camera] Toggled via controller → enabled=${nowEnabled}`);
        } catch (err) {
          console.error('[Camera] Toggle failed:', err);
          state.dhCameraEnabled = false;
        }
      },
      onToggleSubtitle: () => {
        state.dhSubtitleVisible = !(state.dhSubtitleVisible ?? true);
      },
      onVideoDoubleClick: async () => {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          const panel = document.querySelector(".panel-dh") as HTMLElement | null;
          if (panel) {
            await panel.requestFullscreen();
          }
        }
      },
      selectedVoice: (state as unknown as Record<string, string>).dhSelectedVoice ?? DH_DEFAULT_VOICE,
      onVoiceChange: (voiceId: string) => {
        (state as unknown as Record<string, string>).dhSelectedVoice = voiceId;
        // Store on window (voice-action fallback + diagnostics can read it).
        (window as unknown as Record<string, unknown>).__dhSelectedVoice = voiceId;
        // Tier 2: live-switch the Qwen realtime voice — the controller sends a
        // `voice_change` command over the DH WS and the node re-connects the
        // realtime session with the new voice (next spoken turn uses it).
        const ctrl = (window as unknown as Record<string, unknown>).__dhController as
          | { setVoice?: (v: string) => boolean }
          | null;
        if (ctrl && typeof ctrl.setVoice === "function") {
          ctrl.setVoice(voiceId);
        } else {
          console.warn("[Voice] Controller not ready — start a DH session first");
        }
      },
    },
    chatPanel: {
      sessionKey: state.sessionKey,
      onSessionKeyChange: (next) => {
        state.sessionKey = next;
        state.chatMessage = "";
        state.chatAttachments = [];
        state.chatStream = null;
        state.chatStreamStartedAt = null;
        state.chatRunId = null;
        state.chatQueue = [];
        state.resetToolStream();
        state.resetChatScroll();
        state.applySettings({
          ...state.settings,
          sessionKey: next,
          lastActiveSessionKey: next,
        });
        void state.loadAssistantIdentity();
        void loadChatHistory(state);
        void refreshChatAvatar(state);
      },
      thinkingLevel: state.chatThinkingLevel,
      showThinking,
      loading: state.chatLoading,
      sending: state.chatSending,
      canAbort: Boolean(state.chatRunId),
      compactionStatus: state.compactionStatus,
      assistantAvatarUrl: chatAvatarUrl,
      messages: state.chatMessages,
      toolMessages: state.chatToolMessages,
      stream: state.chatStream,
      streamStartedAt: state.chatStreamStartedAt,
      draft: state.chatMessage,
      queue: state.chatQueue,
      connected: state.connected,
      canSend: state.connected,
      disabledReason: chatDisabledReason,
      error: state.lastError,
      sessions: state.sessionsResult,
      focusMode: false,
      sidebarOpen: state.sidebarOpen,
      sidebarContent: state.sidebarContent,
      sidebarError: state.sidebarError,
      sidebarMode: state.sidebarMode,
      splitRatio: state.splitRatio,
      execLogEntries: state.execLogEntries,
      execLogActive: state.execLogActive,
      execLogAutoScroll: state.execLogAutoScroll,
      assistantName: state.assistantName,
      assistantAvatar: state.assistantAvatar,
      attachments: state.chatAttachments,
      onAttachmentsChange: (next) => (state.chatAttachments = next),
      showNewMessages: state.chatNewMessagesBelow && !state.chatManualRefreshInFlight,
      onScrollToBottom: () => state.scrollToBottom(),
      onRefresh: () => {
        state.resetToolStream();
        return Promise.all([loadChatHistory(state), refreshChatAvatar(state)]);
      },
      onToggleFocusMode: () => {},
      onChatScroll: (event) => state.handleChatScroll(event),
      onDraftChange: (next) => (state.chatMessage = next),
      onSend: () => state.handleSendChat(),
      onAbort: () => void state.handleAbortChat(),
      onQueueRemove: (id) => state.removeQueuedMessage(id),
      onNewSession,
      onOpenSidebar: (content) => state.handleOpenSidebar(content),
      onCloseSidebar: () => state.handleCloseSidebar(),
      onSplitRatioChange: (ratio) => state.handleSplitRatioChange(ratio),
      onOpenExecLog: () => state.handleOpenExecLog(),
      onCloseExecLog: () => state.handleCloseExecLog(),
      onClearExecLog: () => state.handleClearExecLog(),
      onToggleExecLogAutoScroll: () => state.handleToggleExecLogAutoScroll(),
    },
  };
}

function resolveChatSessionTitle(state: AppViewState): string | undefined {
  const sessions = state.sessionsResult?.sessions;
  if (!sessions) {
    return undefined;
  }
  const row = sessions.find((s) => s.key === state.sessionKey);
  return row?.derivedTitle || row?.displayName || row?.label || undefined;
}

/**
 * ロード時 auto-connect(docs/10 §4.2): DH 画面に入ったら自動で Qwen セッションを接続する
 * (画面に入れば即対話可能に)。マイクは権限許可済なら即 ON、未許可時はブラウザが1ジェスチャを
 * 要求する場合がある。初回1回だけ。onStart 本体(ボタンと同一経路)を再利用する。
 */
function maybeAutoStartDh(state: AppViewState, ls: MainLayoutState): MainLayoutState {
  const st = state.dhConnectionStatus ?? "disconnected";
  if (!state.dhAutoStartAttempted && !state.dhController && st === "disconnected") {
    state.dhAutoStartAttempted = true;
    queueMicrotask(() => {
      try {
        ls.dhPanel.onStart();
      } catch {
        /* noop */
      }
    });
  }
  return ls;
}

export function renderApp(state: AppViewState) {
  // Bind the voice UI-control listener once (Sprint D). Lazy so it captures a
  // live state; guarded internally against duplicate registration.
  ensureDhUiActionListener(state);

  const presenceCount = state.presenceEntries.length;
  const sessionsCount = state.sessionsResult?.count ?? null;
  const cronNext = state.cronStatus?.nextWakeAtMs ?? null;
  const chatDisabledReason = state.connected ? null : "Disconnected from gateway.";
  const isChat = state.tab === "chat";
  const isDH = state.tab === "digital-human";
  const chatFocus = isChat && (state.settings.chatFocusMode || state.onboarding);
  const showThinking = state.onboarding ? false : state.settings.chatShowThinking;
  const assistantAvatarUrl = resolveAssistantAvatarUrl(state);
  const chatAvatarUrl = state.chatAvatarUrl ?? assistantAvatarUrl ?? null;
  const configValue =
    state.configForm ?? (state.configSnapshot?.config as Record<string, unknown> | null);
  const basePath = normalizeBasePath(state.basePath ?? "");
  const resolvedAgentId =
    state.agentsSelectedId ??
    state.agentsList?.defaultId ??
    state.agentsList?.agents?.[0]?.id ??
    null;

  return html`
    <div class="shell ${isChat ? "shell--chat" : ""} ${isDH ? "shell--dh" : ""} ${state.onboarding ? "shell--onboarding" : ""}">
      <header class="topbar">
        <div class="topbar-left">
          <div class="brand">
            <div class="brand-logo">
              <img src=${basePath ? `${basePath}/favicon.svg` : "/favicon.svg"} alt="WinClaw" />
            </div>
            <div class="brand-title">WinClaw</div>
          </div>
        </div>
        <div class="topbar-center">
          <span class="statusDot ${state.connected ? "ok" : ""}"></span>
          <span>${state.connected ? "Connected" : "Disconnected"}</span>
        </div>
        <div class="topbar-right">
          ${renderLanguageSelector({ className: "topbar-lang" })}
          <button class="topbar-cmd-btn" @click=${() => state.toggleCommandPalette()} title="Command Palette (Ctrl+K)">
            Ctrl+K
          </button>
          <button class="topbar-add-btn" @click=${() => state.toggleCommandPalette()} title="Open command palette">
            +
          </button>
        </div>
      </header>
      <main class="content ${isChat ? "content--chat" : ""}">
        ${renderSessionTabs({
          activeTab: state.tab,
          openTabs: state.openTabs,
          chatSessionTitle: resolveChatSessionTitle(state),
          onTabSelect: (tab) => state.openTabFromPalette(tab),
          onTabClose: (tab) => state.closeTab(tab),
          onAddTab: () => state.toggleCommandPalette(),
        })}
        ${
          isChat
            ? nothing
            : html`
              <section class="content-header">
                <div>
                  ${state.tab === "usage" ? nothing : html`<div class="page-title">${titleForTab(state.tab)}</div>`}
                  ${state.tab === "usage" ? nothing : html`<div class="page-sub">${subtitleForTab(state.tab)}</div>`}
                </div>
                <div class="page-meta">
                  ${state.lastError ? html`<div class="pill danger">${state.lastError}</div>` : nothing}
                </div>
              </section>
            `
        }

        ${
          state.tab === "overview"
            ? renderOverview({
                connected: state.connected,
                hello: state.hello,
                settings: state.settings,
                password: state.password,
                lastError: state.lastError,
                presenceCount,
                sessionsCount,
                cronEnabled: state.cronStatus?.enabled ?? null,
                cronNext,
                lastChannelsRefresh: state.channelsLastSuccess,
                onSettingsChange: (next) => state.applySettings(next),
                onPasswordChange: (next) => (state.password = next),
                onSessionKeyChange: (next) => {
                  state.sessionKey = next;
                  state.chatMessage = "";
                  state.resetToolStream();
                  state.applySettings({
                    ...state.settings,
                    sessionKey: next,
                    lastActiveSessionKey: next,
                  });
                  void state.loadAssistantIdentity();
                },
                onConnect: () => state.connect(),
                onRefresh: () => state.loadOverview(),
              })
            : nothing
        }

        ${
          state.tab === "channels"
            ? renderChannels({
                connected: state.connected,
                loading: state.channelsLoading,
                snapshot: state.channelsSnapshot,
                lastError: state.channelsError,
                lastSuccessAt: state.channelsLastSuccess,
                whatsappMessage: state.whatsappLoginMessage,
                whatsappQrDataUrl: state.whatsappLoginQrDataUrl,
                whatsappConnected: state.whatsappLoginConnected,
                whatsappBusy: state.whatsappBusy,
                configSchema: state.configSchema,
                configSchemaLoading: state.configSchemaLoading,
                configForm: state.configForm,
                configUiHints: state.configUiHints,
                configSaving: state.configSaving,
                configFormDirty: state.configFormDirty,
                nostrProfileFormState: state.nostrProfileFormState,
                nostrProfileAccountId: state.nostrProfileAccountId,
                onRefresh: (probe) => loadChannels(state, probe),
                onWhatsAppStart: (force) => state.handleWhatsAppStart(force),
                onWhatsAppWait: () => state.handleWhatsAppWait(),
                onWhatsAppLogout: () => state.handleWhatsAppLogout(),
                onConfigPatch: (path, value) => updateConfigFormValue(state, path, value),
                onConfigSave: () => state.handleChannelConfigSave(),
                onConfigReload: () => state.handleChannelConfigReload(),
                onNostrProfileEdit: (accountId, profile) =>
                  state.handleNostrProfileEdit(accountId, profile),
                onNostrProfileCancel: () => state.handleNostrProfileCancel(),
                onNostrProfileFieldChange: (field, value) =>
                  state.handleNostrProfileFieldChange(field, value),
                onNostrProfileSave: () => state.handleNostrProfileSave(),
                onNostrProfileImport: () => state.handleNostrProfileImport(),
                onNostrProfileToggleAdvanced: () => state.handleNostrProfileToggleAdvanced(),
              })
            : nothing
        }

        ${
          state.tab === "instances"
            ? renderInstances({
                loading: state.presenceLoading,
                entries: state.presenceEntries,
                lastError: state.presenceError,
                statusMessage: state.presenceStatus,
                onRefresh: () => loadPresence(state),
              })
            : nothing
        }

        ${
          state.tab === "sessions"
            ? renderSessions({
                loading: state.sessionsLoading,
                result: state.sessionsResult,
                error: state.sessionsError,
                activeMinutes: state.sessionsFilterActive,
                limit: state.sessionsFilterLimit,
                includeGlobal: state.sessionsIncludeGlobal,
                includeUnknown: state.sessionsIncludeUnknown,
                basePath: state.basePath,
                onFiltersChange: (next) => {
                  state.sessionsFilterActive = next.activeMinutes;
                  state.sessionsFilterLimit = next.limit;
                  state.sessionsIncludeGlobal = next.includeGlobal;
                  state.sessionsIncludeUnknown = next.includeUnknown;
                },
                onRefresh: () => loadSessions(state),
                onPatch: (key, patch) => patchSession(state, key, patch),
                onDelete: (key) => deleteSession(state, key),
              })
            : nothing
        }

        ${
          state.tab === "usage"
            ? renderUsage({
                loading: state.usageLoading,
                error: state.usageError,
                startDate: state.usageStartDate,
                endDate: state.usageEndDate,
                sessions: state.usageResult?.sessions ?? [],
                sessionsLimitReached: (state.usageResult?.sessions?.length ?? 0) >= 1000,
                totals: state.usageResult?.totals ?? null,
                aggregates: state.usageResult?.aggregates ?? null,
                costDaily: state.usageCostSummary?.daily ?? [],
                selectedSessions: state.usageSelectedSessions,
                selectedDays: state.usageSelectedDays,
                selectedHours: state.usageSelectedHours,
                chartMode: state.usageChartMode,
                dailyChartMode: state.usageDailyChartMode,
                timeSeriesMode: state.usageTimeSeriesMode,
                timeSeriesBreakdownMode: state.usageTimeSeriesBreakdownMode,
                timeSeries: state.usageTimeSeries,
                timeSeriesLoading: state.usageTimeSeriesLoading,
                sessionLogs: state.usageSessionLogs,
                sessionLogsLoading: state.usageSessionLogsLoading,
                sessionLogsExpanded: state.usageSessionLogsExpanded,
                logFilterRoles: state.usageLogFilterRoles,
                logFilterTools: state.usageLogFilterTools,
                logFilterHasTools: state.usageLogFilterHasTools,
                logFilterQuery: state.usageLogFilterQuery,
                query: state.usageQuery,
                queryDraft: state.usageQueryDraft,
                sessionSort: state.usageSessionSort,
                sessionSortDir: state.usageSessionSortDir,
                recentSessions: state.usageRecentSessions,
                sessionsTab: state.usageSessionsTab,
                visibleColumns:
                  state.usageVisibleColumns as import("./views/usage.ts").UsageColumnId[],
                timeZone: state.usageTimeZone,
                contextExpanded: state.usageContextExpanded,
                headerPinned: state.usageHeaderPinned,
                onStartDateChange: (date) => {
                  state.usageStartDate = date;
                  state.usageSelectedDays = [];
                  state.usageSelectedHours = [];
                  state.usageSelectedSessions = [];
                  debouncedLoadUsage(state);
                },
                onEndDateChange: (date) => {
                  state.usageEndDate = date;
                  state.usageSelectedDays = [];
                  state.usageSelectedHours = [];
                  state.usageSelectedSessions = [];
                  debouncedLoadUsage(state);
                },
                onRefresh: () => loadUsage(state),
                onTimeZoneChange: (zone) => {
                  state.usageTimeZone = zone;
                },
                onToggleContextExpanded: () => {
                  state.usageContextExpanded = !state.usageContextExpanded;
                },
                onToggleSessionLogsExpanded: () => {
                  state.usageSessionLogsExpanded = !state.usageSessionLogsExpanded;
                },
                onLogFilterRolesChange: (next) => {
                  state.usageLogFilterRoles = next;
                },
                onLogFilterToolsChange: (next) => {
                  state.usageLogFilterTools = next;
                },
                onLogFilterHasToolsChange: (next) => {
                  state.usageLogFilterHasTools = next;
                },
                onLogFilterQueryChange: (next) => {
                  state.usageLogFilterQuery = next;
                },
                onLogFilterClear: () => {
                  state.usageLogFilterRoles = [];
                  state.usageLogFilterTools = [];
                  state.usageLogFilterHasTools = false;
                  state.usageLogFilterQuery = "";
                },
                onToggleHeaderPinned: () => {
                  state.usageHeaderPinned = !state.usageHeaderPinned;
                },
                onSelectHour: (hour, shiftKey) => {
                  if (shiftKey && state.usageSelectedHours.length > 0) {
                    const allHours = Array.from({ length: 24 }, (_, i) => i);
                    const lastSelected =
                      state.usageSelectedHours[state.usageSelectedHours.length - 1];
                    const lastIdx = allHours.indexOf(lastSelected);
                    const thisIdx = allHours.indexOf(hour);
                    if (lastIdx !== -1 && thisIdx !== -1) {
                      const [start, end] =
                        lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
                      const range = allHours.slice(start, end + 1);
                      state.usageSelectedHours = [
                        ...new Set([...state.usageSelectedHours, ...range]),
                      ];
                    }
                  } else {
                    if (state.usageSelectedHours.includes(hour)) {
                      state.usageSelectedHours = state.usageSelectedHours.filter((h) => h !== hour);
                    } else {
                      state.usageSelectedHours = [...state.usageSelectedHours, hour];
                    }
                  }
                },
                onQueryDraftChange: (query) => {
                  state.usageQueryDraft = query;
                  if (state.usageQueryDebounceTimer) {
                    window.clearTimeout(state.usageQueryDebounceTimer);
                  }
                  state.usageQueryDebounceTimer = window.setTimeout(() => {
                    state.usageQuery = state.usageQueryDraft;
                    state.usageQueryDebounceTimer = null;
                  }, 250);
                },
                onApplyQuery: () => {
                  if (state.usageQueryDebounceTimer) {
                    window.clearTimeout(state.usageQueryDebounceTimer);
                    state.usageQueryDebounceTimer = null;
                  }
                  state.usageQuery = state.usageQueryDraft;
                },
                onClearQuery: () => {
                  if (state.usageQueryDebounceTimer) {
                    window.clearTimeout(state.usageQueryDebounceTimer);
                    state.usageQueryDebounceTimer = null;
                  }
                  state.usageQueryDraft = "";
                  state.usageQuery = "";
                },
                onSessionSortChange: (sort) => {
                  state.usageSessionSort = sort;
                },
                onSessionSortDirChange: (dir) => {
                  state.usageSessionSortDir = dir;
                },
                onSessionsTabChange: (tab) => {
                  state.usageSessionsTab = tab;
                },
                onToggleColumn: (column) => {
                  if (state.usageVisibleColumns.includes(column)) {
                    state.usageVisibleColumns = state.usageVisibleColumns.filter(
                      (entry) => entry !== column,
                    );
                  } else {
                    state.usageVisibleColumns = [...state.usageVisibleColumns, column];
                  }
                },
                onSelectSession: (key, shiftKey) => {
                  state.usageTimeSeries = null;
                  state.usageSessionLogs = null;
                  state.usageRecentSessions = [
                    key,
                    ...state.usageRecentSessions.filter((entry) => entry !== key),
                  ].slice(0, 8);

                  if (shiftKey && state.usageSelectedSessions.length > 0) {
                    // Shift-click: select range from last selected to this session
                    // Sort sessions same way as displayed (by tokens or cost descending)
                    const isTokenMode = state.usageChartMode === "tokens";
                    const sortedSessions = [...(state.usageResult?.sessions ?? [])].toSorted(
                      (a, b) => {
                        const valA = isTokenMode
                          ? (a.usage?.totalTokens ?? 0)
                          : (a.usage?.totalCost ?? 0);
                        const valB = isTokenMode
                          ? (b.usage?.totalTokens ?? 0)
                          : (b.usage?.totalCost ?? 0);
                        return valB - valA;
                      },
                    );
                    const allKeys = sortedSessions.map((s) => s.key);
                    const lastSelected =
                      state.usageSelectedSessions[state.usageSelectedSessions.length - 1];
                    const lastIdx = allKeys.indexOf(lastSelected);
                    const thisIdx = allKeys.indexOf(key);
                    if (lastIdx !== -1 && thisIdx !== -1) {
                      const [start, end] =
                        lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
                      const range = allKeys.slice(start, end + 1);
                      const newSelection = [...new Set([...state.usageSelectedSessions, ...range])];
                      state.usageSelectedSessions = newSelection;
                    }
                  } else {
                    // Regular click: focus a single session (so details always open).
                    // Click the focused session again to clear selection.
                    if (
                      state.usageSelectedSessions.length === 1 &&
                      state.usageSelectedSessions[0] === key
                    ) {
                      state.usageSelectedSessions = [];
                    } else {
                      state.usageSelectedSessions = [key];
                    }
                  }

                  // Load timeseries/logs only if exactly one session selected
                  if (state.usageSelectedSessions.length === 1) {
                    void loadSessionTimeSeries(state, state.usageSelectedSessions[0]);
                    void loadSessionLogs(state, state.usageSelectedSessions[0]);
                  }
                },
                onSelectDay: (day, shiftKey) => {
                  if (shiftKey && state.usageSelectedDays.length > 0) {
                    // Shift-click: select range from last selected to this day
                    const allDays = (state.usageCostSummary?.daily ?? []).map((d) => d.date);
                    const lastSelected =
                      state.usageSelectedDays[state.usageSelectedDays.length - 1];
                    const lastIdx = allDays.indexOf(lastSelected);
                    const thisIdx = allDays.indexOf(day);
                    if (lastIdx !== -1 && thisIdx !== -1) {
                      const [start, end] =
                        lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
                      const range = allDays.slice(start, end + 1);
                      // Merge with existing selection
                      const newSelection = [...new Set([...state.usageSelectedDays, ...range])];
                      state.usageSelectedDays = newSelection;
                    }
                  } else {
                    // Regular click: toggle single day
                    if (state.usageSelectedDays.includes(day)) {
                      state.usageSelectedDays = state.usageSelectedDays.filter((d) => d !== day);
                    } else {
                      state.usageSelectedDays = [day];
                    }
                  }
                },
                onChartModeChange: (mode) => {
                  state.usageChartMode = mode;
                },
                onDailyChartModeChange: (mode) => {
                  state.usageDailyChartMode = mode;
                },
                onTimeSeriesModeChange: (mode) => {
                  state.usageTimeSeriesMode = mode;
                },
                onTimeSeriesBreakdownChange: (mode) => {
                  state.usageTimeSeriesBreakdownMode = mode;
                },
                onClearDays: () => {
                  state.usageSelectedDays = [];
                },
                onClearHours: () => {
                  state.usageSelectedHours = [];
                },
                onClearSessions: () => {
                  state.usageSelectedSessions = [];
                  state.usageTimeSeries = null;
                  state.usageSessionLogs = null;
                },
                onClearFilters: () => {
                  state.usageSelectedDays = [];
                  state.usageSelectedHours = [];
                  state.usageSelectedSessions = [];
                  state.usageTimeSeries = null;
                  state.usageSessionLogs = null;
                },
              })
            : nothing
        }

        ${
          state.tab === "cron"
            ? renderCron({
                basePath: state.basePath,
                loading: state.cronLoading,
                status: state.cronStatus,
                jobs: state.cronJobs,
                error: state.cronError,
                busy: state.cronBusy,
                form: state.cronForm,
                channels: state.channelsSnapshot?.channelMeta?.length
                  ? state.channelsSnapshot.channelMeta.map((entry) => entry.id)
                  : (state.channelsSnapshot?.channelOrder ?? []),
                channelLabels: state.channelsSnapshot?.channelLabels ?? {},
                channelMeta: state.channelsSnapshot?.channelMeta ?? [],
                runsJobId: state.cronRunsJobId,
                runs: state.cronRuns,
                onFormChange: (patch) => (state.cronForm = { ...state.cronForm, ...patch }),
                onRefresh: () => state.loadCron(),
                onAdd: () => addCronJob(state),
                onToggle: (job, enabled) => toggleCronJob(state, job, enabled),
                onRun: (job) => runCronJob(state, job),
                onRemove: (job) => removeCronJob(state, job),
                onLoadRuns: (jobId) => loadCronRuns(state, jobId),
              })
            : nothing
        }

        ${
          state.tab === "agents"
            ? renderAgents({
                loading: state.agentsLoading,
                error: state.agentsError,
                agentsList: state.agentsList,
                selectedAgentId: resolvedAgentId,
                activePanel: state.agentsPanel,
                configForm: configValue,
                configLoading: state.configLoading,
                configSaving: state.configSaving,
                configDirty: state.configFormDirty,
                channelsLoading: state.channelsLoading,
                channelsError: state.channelsError,
                channelsSnapshot: state.channelsSnapshot,
                channelsLastSuccess: state.channelsLastSuccess,
                cronLoading: state.cronLoading,
                cronStatus: state.cronStatus,
                cronJobs: state.cronJobs,
                cronError: state.cronError,
                agentFilesLoading: state.agentFilesLoading,
                agentFilesError: state.agentFilesError,
                agentFilesList: state.agentFilesList,
                agentFileActive: state.agentFileActive,
                agentFileContents: state.agentFileContents,
                agentFileDrafts: state.agentFileDrafts,
                agentFileSaving: state.agentFileSaving,
                agentIdentityLoading: state.agentIdentityLoading,
                agentIdentityError: state.agentIdentityError,
                agentIdentityById: state.agentIdentityById,
                agentSkillsLoading: state.agentSkillsLoading,
                agentSkillsReport: state.agentSkillsReport,
                agentSkillsError: state.agentSkillsError,
                agentSkillsAgentId: state.agentSkillsAgentId,
                skillsFilter: state.skillsFilter,
                onRefresh: async () => {
                  await loadAgents(state);
                  const agentIds = state.agentsList?.agents?.map((entry) => entry.id) ?? [];
                  if (agentIds.length > 0) {
                    void loadAgentIdentities(state, agentIds);
                  }
                },
                onSelectAgent: (agentId) => {
                  if (state.agentsSelectedId === agentId) {
                    return;
                  }
                  state.agentsSelectedId = agentId;
                  state.agentFilesList = null;
                  state.agentFilesError = null;
                  state.agentFilesLoading = false;
                  state.agentFileActive = null;
                  state.agentFileContents = {};
                  state.agentFileDrafts = {};
                  state.agentSkillsReport = null;
                  state.agentSkillsError = null;
                  state.agentSkillsAgentId = null;
                  void loadAgentIdentity(state, agentId);
                  if (state.agentsPanel === "files") {
                    void loadAgentFiles(state, agentId);
                  }
                  if (state.agentsPanel === "skills") {
                    void loadAgentSkills(state, agentId);
                  }
                },
                onSelectPanel: (panel) => {
                  state.agentsPanel = panel;
                  if (panel === "files" && resolvedAgentId) {
                    if (state.agentFilesList?.agentId !== resolvedAgentId) {
                      state.agentFilesList = null;
                      state.agentFilesError = null;
                      state.agentFileActive = null;
                      state.agentFileContents = {};
                      state.agentFileDrafts = {};
                      void loadAgentFiles(state, resolvedAgentId);
                    }
                  }
                  if (panel === "skills") {
                    if (resolvedAgentId) {
                      void loadAgentSkills(state, resolvedAgentId);
                    }
                  }
                  if (panel === "channels") {
                    void loadChannels(state, false);
                  }
                  if (panel === "cron") {
                    void state.loadCron();
                  }
                },
                onLoadFiles: (agentId) => loadAgentFiles(state, agentId),
                onSelectFile: (name) => {
                  state.agentFileActive = name;
                  if (!resolvedAgentId) {
                    return;
                  }
                  void loadAgentFileContent(state, resolvedAgentId, name);
                },
                onFileDraftChange: (name, content) => {
                  state.agentFileDrafts = { ...state.agentFileDrafts, [name]: content };
                },
                onFileReset: (name) => {
                  const base = state.agentFileContents[name] ?? "";
                  state.agentFileDrafts = { ...state.agentFileDrafts, [name]: base };
                },
                onFileSave: (name) => {
                  if (!resolvedAgentId) {
                    return;
                  }
                  const content =
                    state.agentFileDrafts[name] ?? state.agentFileContents[name] ?? "";
                  void saveAgentFile(state, resolvedAgentId, name, content);
                },
                onToolsProfileChange: (agentId, profile, clearAllow) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "tools"];
                  if (profile) {
                    updateConfigFormValue(state, [...basePath, "profile"], profile);
                  } else {
                    removeConfigFormValue(state, [...basePath, "profile"]);
                  }
                  if (clearAllow) {
                    removeConfigFormValue(state, [...basePath, "allow"]);
                  }
                },
                onToolsOverridesChange: (agentId, alsoAllow, deny) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "tools"];
                  if (alsoAllow.length > 0) {
                    updateConfigFormValue(state, [...basePath, "alsoAllow"], alsoAllow);
                  } else {
                    removeConfigFormValue(state, [...basePath, "alsoAllow"]);
                  }
                  if (deny.length > 0) {
                    updateConfigFormValue(state, [...basePath, "deny"], deny);
                  } else {
                    removeConfigFormValue(state, [...basePath, "deny"]);
                  }
                },
                onConfigReload: () => loadConfig(state),
                onConfigSave: () => saveConfig(state),
                onChannelsRefresh: () => loadChannels(state, false),
                onCronRefresh: () => state.loadCron(),
                onSkillsFilterChange: (next) => (state.skillsFilter = next),
                onSkillsRefresh: () => {
                  if (resolvedAgentId) {
                    void loadAgentSkills(state, resolvedAgentId);
                  }
                },
                onAgentSkillToggle: (agentId, skillName, enabled) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const entry = list[index] as { skills?: unknown };
                  const normalizedSkill = skillName.trim();
                  if (!normalizedSkill) {
                    return;
                  }
                  const allSkills =
                    state.agentSkillsReport?.skills?.map((skill) => skill.name).filter(Boolean) ??
                    [];
                  const existing = Array.isArray(entry.skills)
                    ? entry.skills.map((name) => String(name).trim()).filter(Boolean)
                    : undefined;
                  const base = existing ?? allSkills;
                  const next = new Set(base);
                  if (enabled) {
                    next.add(normalizedSkill);
                  } else {
                    next.delete(normalizedSkill);
                  }
                  updateConfigFormValue(state, ["agents", "list", index, "skills"], [...next]);
                },
                onAgentSkillsClear: (agentId) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  removeConfigFormValue(state, ["agents", "list", index, "skills"]);
                },
                onAgentSkillsDisableAll: (agentId) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  updateConfigFormValue(state, ["agents", "list", index, "skills"], []);
                },
                onModelChange: (agentId, modelId) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "model"];
                  if (!modelId) {
                    removeConfigFormValue(state, basePath);
                    return;
                  }
                  const entry = list[index] as { model?: unknown };
                  const existing = entry?.model;
                  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
                    const fallbacks = (existing as { fallbacks?: unknown }).fallbacks;
                    const next = {
                      primary: modelId,
                      ...(Array.isArray(fallbacks) ? { fallbacks } : {}),
                    };
                    updateConfigFormValue(state, basePath, next);
                  } else {
                    updateConfigFormValue(state, basePath, modelId);
                  }
                },
                onModelFallbacksChange: (agentId, fallbacks) => {
                  if (!configValue) {
                    return;
                  }
                  const list = (configValue as { agents?: { list?: unknown[] } }).agents?.list;
                  if (!Array.isArray(list)) {
                    return;
                  }
                  const index = list.findIndex(
                    (entry) =>
                      entry &&
                      typeof entry === "object" &&
                      "id" in entry &&
                      (entry as { id?: string }).id === agentId,
                  );
                  if (index < 0) {
                    return;
                  }
                  const basePath = ["agents", "list", index, "model"];
                  const entry = list[index] as { model?: unknown };
                  const normalized = fallbacks.map((name) => name.trim()).filter(Boolean);
                  const existing = entry.model;
                  const resolvePrimary = () => {
                    if (typeof existing === "string") {
                      return existing.trim() || null;
                    }
                    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
                      const primary = (existing as { primary?: unknown }).primary;
                      if (typeof primary === "string") {
                        const trimmed = primary.trim();
                        return trimmed || null;
                      }
                    }
                    return null;
                  };
                  const primary = resolvePrimary();
                  if (normalized.length === 0) {
                    if (primary) {
                      updateConfigFormValue(state, basePath, primary);
                    } else {
                      removeConfigFormValue(state, basePath);
                    }
                    return;
                  }
                  const next = primary
                    ? { primary, fallbacks: normalized }
                    : { fallbacks: normalized };
                  updateConfigFormValue(state, basePath, next);
                },
              })
            : nothing
        }

        ${
          state.tab === "skills"
            ? renderSkills({
                loading: state.skillsLoading,
                report: state.skillsReport,
                error: state.skillsError,
                filter: state.skillsFilter,
                edits: state.skillEdits,
                messages: state.skillMessages,
                busyKey: state.skillsBusyKey,
                onFilterChange: (next) => (state.skillsFilter = next),
                onRefresh: () => loadSkills(state, { clearMessages: true }),
                onToggle: (key, enabled) => updateSkillEnabled(state, key, enabled),
                onEdit: (key, value) => updateSkillEdit(state, key, value),
                onSaveKey: (key) => saveSkillApiKey(state, key),
                onInstall: (skillKey, name, installId) =>
                  installSkill(state, skillKey, name, installId),
              })
            : nothing
        }

        ${
          state.tab === "nodes"
            ? renderNodes({
                loading: state.nodesLoading,
                nodes: state.nodes,
                devicesLoading: state.devicesLoading,
                devicesError: state.devicesError,
                devicesList: state.devicesList,
                configForm:
                  state.configForm ??
                  (state.configSnapshot?.config as Record<string, unknown> | null),
                configLoading: state.configLoading,
                configSaving: state.configSaving,
                configDirty: state.configFormDirty,
                configFormMode: state.configFormMode,
                execApprovalsLoading: state.execApprovalsLoading,
                execApprovalsSaving: state.execApprovalsSaving,
                execApprovalsDirty: state.execApprovalsDirty,
                execApprovalsSnapshot: state.execApprovalsSnapshot,
                execApprovalsForm: state.execApprovalsForm,
                execApprovalsSelectedAgent: state.execApprovalsSelectedAgent,
                execApprovalsTarget: state.execApprovalsTarget,
                execApprovalsTargetNodeId: state.execApprovalsTargetNodeId,
                onRefresh: () => loadNodes(state),
                onDevicesRefresh: () => loadDevices(state),
                onDeviceApprove: (requestId) => approveDevicePairing(state, requestId),
                onDeviceReject: (requestId) => rejectDevicePairing(state, requestId),
                onDeviceRotate: (deviceId, role, scopes) =>
                  rotateDeviceToken(state, { deviceId, role, scopes }),
                onDeviceRevoke: (deviceId, role) => revokeDeviceToken(state, { deviceId, role }),
                onLoadConfig: () => loadConfig(state),
                onLoadExecApprovals: () => {
                  const target =
                    state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
                      ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
                      : { kind: "gateway" as const };
                  return loadExecApprovals(state, target);
                },
                onBindDefault: (nodeId) => {
                  if (nodeId) {
                    updateConfigFormValue(state, ["tools", "exec", "node"], nodeId);
                  } else {
                    removeConfigFormValue(state, ["tools", "exec", "node"]);
                  }
                },
                onBindAgent: (agentIndex, nodeId) => {
                  const basePath = ["agents", "list", agentIndex, "tools", "exec", "node"];
                  if (nodeId) {
                    updateConfigFormValue(state, basePath, nodeId);
                  } else {
                    removeConfigFormValue(state, basePath);
                  }
                },
                onSaveBindings: () => saveConfig(state),
                onExecApprovalsTargetChange: (kind, nodeId) => {
                  state.execApprovalsTarget = kind;
                  state.execApprovalsTargetNodeId = nodeId;
                  state.execApprovalsSnapshot = null;
                  state.execApprovalsForm = null;
                  state.execApprovalsDirty = false;
                  state.execApprovalsSelectedAgent = null;
                },
                onExecApprovalsSelectAgent: (agentId) => {
                  state.execApprovalsSelectedAgent = agentId;
                },
                onExecApprovalsPatch: (path, value) =>
                  updateExecApprovalsFormValue(state, path, value),
                onExecApprovalsRemove: (path) => removeExecApprovalsFormValue(state, path),
                onSaveExecApprovals: () => {
                  const target =
                    state.execApprovalsTarget === "node" && state.execApprovalsTargetNodeId
                      ? { kind: "node" as const, nodeId: state.execApprovalsTargetNodeId }
                      : { kind: "gateway" as const };
                  return saveExecApprovals(state, target);
                },
              })
            : nothing
        }

        ${
          isDH && state.dhAvailable
            ? renderMainLayout(maybeAutoStartDh(state, buildMainLayoutState(state, () => void createNewChatSession(state))))
            : nothing
        }

        ${
          state.tab === "chat" || (isDH && !state.dhAvailable)
            ? html`${renderChatControls(state, {
                onNewSession: () => void createNewChatSession(state),
              })}${renderChat({
                sessionKey: state.sessionKey,
                onSessionKeyChange: (next) => {
                  state.sessionKey = next;
                  state.chatMessage = "";
                  state.chatAttachments = [];
                  state.chatStream = null;
                  state.chatStreamStartedAt = null;
                  state.chatRunId = null;
                  state.chatQueue = [];
                  state.resetToolStream();
                  state.resetChatScroll();
                  state.applySettings({
                    ...state.settings,
                    sessionKey: next,
                    lastActiveSessionKey: next,
                  });
                  void state.loadAssistantIdentity();
                  void loadChatHistory(state);
                  void refreshChatAvatar(state);
                },
                thinkingLevel: state.chatThinkingLevel,
                showThinking,
                loading: state.chatLoading,
                sending: state.chatSending,
                compactionStatus: state.compactionStatus,
                assistantAvatarUrl: chatAvatarUrl,
                messages: state.chatMessages,
                toolMessages: state.chatToolMessages,
                stream: state.chatStream,
                streamStartedAt: state.chatStreamStartedAt,
                draft: state.chatMessage,
                queue: state.chatQueue,
                connected: state.connected,
                canSend: state.connected,
                disabledReason: chatDisabledReason,
                error: state.lastError,
                sessions: state.sessionsResult,
                focusMode: chatFocus,
                onRefresh: () => {
                  state.resetToolStream();
                  return Promise.all([loadChatHistory(state), refreshChatAvatar(state)]);
                },
                onToggleFocusMode: () => {
                  if (state.onboarding) {
                    return;
                  }
                  state.applySettings({
                    ...state.settings,
                    chatFocusMode: !state.settings.chatFocusMode,
                  });
                },
                onChatScroll: (event) => state.handleChatScroll(event),
                onDraftChange: (next) => (state.chatMessage = next),
                attachments: state.chatAttachments,
                onAttachmentsChange: (next) => (state.chatAttachments = next),
                onSend: () => state.handleSendChat(),
                canAbort: Boolean(state.chatRunId),
                onAbort: () => void state.handleAbortChat(),
                onQueueRemove: (id) => state.removeQueuedMessage(id),
                onNewSession: () => void createNewChatSession(state),
                showNewMessages: state.chatNewMessagesBelow && !state.chatManualRefreshInFlight,
                onScrollToBottom: () => state.scrollToBottom(),
                // Sidebar props for tool output viewing
                sidebarOpen: state.sidebarOpen,
                sidebarContent: state.sidebarContent,
                sidebarError: state.sidebarError,
                sidebarMode: state.sidebarMode,
                splitRatio: state.splitRatio,
                onOpenSidebar: (content: string) => state.handleOpenSidebar(content),
                onCloseSidebar: () => state.handleCloseSidebar(),
                onSplitRatioChange: (ratio: number) => state.handleSplitRatioChange(ratio),
                // Exec log console props
                execLogEntries: state.execLogEntries,
                execLogActive: state.execLogActive,
                execLogAutoScroll: state.execLogAutoScroll,
                onOpenExecLog: () => state.handleOpenExecLog(),
                onCloseExecLog: () => state.handleCloseExecLog(),
                onClearExecLog: () => state.handleClearExecLog(),
                onToggleExecLogAutoScroll: () => state.handleToggleExecLogAutoScroll(),
                assistantName: state.assistantName,
                assistantAvatar: state.assistantAvatar,
              })}`
            : nothing
        }

        ${
          state.tab === "personal"
            ? renderPersonalInfo({
                loading: state.personalInfoLoading,
                saving: state.personalInfoSaving,
                data: state.personalInfo,
                form: state.personalInfoForm,
                dirty: state.personalInfoDirty,
                error: state.personalInfoError,
                success: state.personalInfoSuccess,
                onFieldChange: (field, value) => updatePersonalInfoField(state, field, value),
                onSave: () => void savePersonalInfo(state),
                onRefresh: () => void loadPersonalInfo(state),
              })
            : nothing
        }

        ${
          state.tab === "config"
            ? renderConfig({
                raw: state.configRaw,
                originalRaw: state.configRawOriginal,
                valid: state.configValid,
                issues: state.configIssues,
                loading: state.configLoading,
                saving: state.configSaving,
                applying: state.configApplying,
                updating: state.updateRunning,
                connected: state.connected,
                schema: state.configSchema,
                schemaLoading: state.configSchemaLoading,
                uiHints: state.configUiHints,
                formMode: state.configFormMode,
                formValue: state.configForm,
                originalValue: state.configFormOriginal,
                searchQuery: state.configSearchQuery,
                activeSection: state.configActiveSection,
                activeSubsection: state.configActiveSubsection,
                onRawChange: (next) => {
                  state.configRaw = next;
                },
                onFormModeChange: (mode) => (state.configFormMode = mode),
                onFormPatch: (path, value) => updateConfigFormValue(state, path, value),
                onSearchChange: (query) => (state.configSearchQuery = query),
                onSectionChange: (section) => {
                  state.configActiveSection = section;
                  state.configActiveSubsection = null;
                },
                onSubsectionChange: (section) => (state.configActiveSubsection = section),
                onReload: () => loadConfig(state),
                onSave: () => saveConfig(state),
                onApply: () => applyConfig(state),
                onUpdate: () => runUpdate(state),
              })
            : nothing
        }

        ${
          state.tab === "debug"
            ? renderDebug({
                loading: state.debugLoading,
                status: state.debugStatus,
                health: state.debugHealth,
                models: state.debugModels,
                heartbeat: state.debugHeartbeat,
                eventLog: state.eventLog,
                callMethod: state.debugCallMethod,
                callParams: state.debugCallParams,
                callResult: state.debugCallResult,
                callError: state.debugCallError,
                onCallMethodChange: (next) => (state.debugCallMethod = next),
                onCallParamsChange: (next) => (state.debugCallParams = next),
                onRefresh: () => loadDebug(state),
                onCall: () => callDebugMethod(state),
              })
            : nothing
        }

        ${
          state.tab === "logs"
            ? renderLogs({
                loading: state.logsLoading,
                error: state.logsError,
                file: state.logsFile,
                entries: state.logsEntries,
                filterText: state.logsFilterText,
                levelFilters: state.logsLevelFilters,
                autoFollow: state.logsAutoFollow,
                truncated: state.logsTruncated,
                onFilterTextChange: (next) => (state.logsFilterText = next),
                onLevelToggle: (level, enabled) => {
                  state.logsLevelFilters = { ...state.logsLevelFilters, [level]: enabled };
                },
                onToggleAutoFollow: (next) => (state.logsAutoFollow = next),
                onRefresh: () => loadLogs(state, { reset: true }),
                onExport: (lines, label) => state.exportLogs(lines, label),
                onScroll: (event) => state.handleLogsScroll(event),
              })
            : nothing
        }
      </main>
      <!-- statusbar footer 削除（ユーザ要望 2026-07-07: 「Gateway: OK」状態条を非表示） -->
      ${renderCommandPalette({
        open: state.commandPaletteOpen,
        recentCommandIds: state.recentCommands,
        onSelect: (cmd) => {
          state.addRecentCommand(cmd.id);
          if (cmd.id === "new-chat") {
            state.openTabFromPalette("chat");
            void createNewChatSession(state);
          } else if (cmd.tab) {
            state.openTabFromPalette(cmd.tab);
          }
          state.commandPaletteOpen = false;
        },
        onClose: () => {
          state.commandPaletteOpen = false;
        },
      })}
      ${renderExecApprovalPrompt(state)}
      ${renderGatewayUrlConfirmation(state)}
    </div>
  `;
}
