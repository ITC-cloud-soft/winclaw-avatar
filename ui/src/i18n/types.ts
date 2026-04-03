/**
 * WinClaw i18n — Translation key type definitions
 *
 * This interface enforces completeness across all locale files.
 * Every locale JSON must satisfy this shape.
 */

export interface LocaleMessages {
  app: {
    /** Application title shown in the browser tab and header */
    title: string;
    /** Status label when the gateway connection is established */
    online: string;
    /** Status label when the gateway connection is lost */
    offline: string;
    /** Status label while the initial connection is being established */
    connecting: string;
  };

  topbar: {
    /** Settings panel trigger label */
    settings: string;
    /** Theme switcher label */
    theme: string;
    /** Language switcher label */
    language: string;
  };

  dh: {
    /** Overlay prompt shown before a session is started */
    clickToStart: string;
    /** Button to initiate a digital-human session */
    startSession: string;
    /** Button to terminate the current session */
    endSession: string;
    /** Generic microphone label */
    microphone: string;
    /** Generic camera label */
    camera: string;
    /** Tooltip/label when microphone is active */
    micOn: string;
    /** Tooltip/label when microphone is muted */
    micOff: string;
    /** Tooltip/label when camera is active */
    camOn: string;
    /** Tooltip/label when camera is disabled */
    camOff: string;
    /** Subtitle / closed-caption toggle label */
    subtitle: string;
    /** Status message while establishing the digital-human connection */
    connecting: string;
    /** Status message after the digital-human stream is ready */
    connected: string;
    /** Status message after the stream has ended */
    disconnected: string;
    /** Status message when a connection error has occurred */
    error: string;
    /** Enter full-screen label */
    fullscreen: string;
    /** Exit full-screen label */
    exitFullscreen: string;
    /** Live indicator shown while the AI is producing speech */
    aiSpeaking: string;
    /** Live indicator shown while the system is capturing user voice */
    listening: string;
    /** Live indicator shown while the backend is processing the request */
    processing: string;
    /** Short status badge shown while connecting */
    statusConnecting: string;
    /** Short status badge shown when connected and live */
    statusConnected: string;
    /** Short status badge shown on error */
    statusError: string;
    /** Short status badge shown when disconnected */
    statusDisconnected: string;
    /** Alt text for the digital-human avatar image/video */
    avatarAlt: string;
    /** ARIA label for the digital-human video stream element */
    videoLabel: string;
    /** ARIA label for the camera preview picture-in-picture */
    cameraPreviewLabel: string;
    /** ARIA label for the controls toolbar */
    controlsLabel: string;
    /** ARIA label for the digital-human panel region */
    panelLabel: string;
    /** Tooltip to collapse the subtitle overlay */
    collapseSubtitle: string;
    /** Tooltip to expand the subtitle overlay */
    expandSubtitle: string;
  };

  chat: {
    /** Panel heading for the conversation history section */
    title: string;
    /** Placeholder text inside the message input field */
    inputPlaceholder: string;
    /** Send-message button label */
    send: string;
    /** Clear-history button label */
    clear: string;
    /** Enter full-screen label for the chat panel */
    fullscreen: string;
    /** Exit full-screen label for the chat panel */
    exitFullscreen: string;
    /** Badge/label for voice-originated messages */
    voiceMessage: string;
    /** Badge/label for text-originated messages */
    textMessage: string;
    /** Inline status while an agent task is running */
    taskRunning: string;
    /** Inline status when an agent task finished successfully */
    taskSuccess: string;
    /** Inline status when an agent task has failed */
    taskFailed: string;
    /** Tooltip for the image-attachment button */
    attachImage: string;
    /** Context-menu / tooltip for copying a message */
    copyMessage: string;
    /** ARIA label for the chat panel region */
    panelLabel: string;
  };

  settings: {
    /** Settings panel heading */
    title: string;
    /** General section heading */
    general: string;
    /** Language selector label within settings */
    language: string;
    /** Theme section label */
    theme: string;
    /** Dark mode option */
    themeDark: string;
    /** Light mode option */
    themeLight: string;
    /** System/automatic theme option */
    themeAuto: string;
    /** Qwen voice-model section label */
    qwen: string;
    /** Voice timbre / speaker selection label */
    qwenVoice: string;
    /** ByteDance digital-human section label */
    bytedance: string;
    /** Digital-human role/avatar selection label */
    bytedanceRole: string;
    /** Identity (SOUL / IDENTITY files) section label */
    identity: string;
    /** Memory system section label */
    memory: string;
    /** Advanced options section label */
    advanced: string;
    /** Save button label */
    save: string;
    /** Cancel button label */
    cancel: string;
    /** Confirmation message after a successful save */
    saved: string;
  };

  nav: {
    /** Settings navigation label */
    settings: string;
    /** Theme toggle label */
    theme: string;
  };

  layout: {
    /** Tooltip to enter digital-human full-screen mode */
    dhFullscreen: string;
    /** Tooltip to enter chat full-screen mode */
    chatFullscreen: string;
    /** Tooltip to exit any full-screen mode */
    exitFullscreen: string;
  };

  status: {
    /** Generic "connected" state label for the status bar */
    connected: string;
    /** Generic "disconnected" state label for the status bar */
    disconnected: string;
    /** Digital-human online indicator */
    dhOnline: string;
    /** Digital-human offline indicator */
    dhOffline: string;
    /** Current model name prefix in the status bar */
    model: string;
  };
}
