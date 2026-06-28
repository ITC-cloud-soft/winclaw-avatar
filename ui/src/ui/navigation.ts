import type { IconName } from "./icons.js";
import { t } from "../i18n/index.js";

export const TAB_GROUPS = [
  { label: "Chat", tabs: ["chat"] },
  { label: "Digital Human", tabs: ["digital-human"] },
  {
    label: "Control",
    tabs: ["overview", "channels", "instances", "sessions", "usage", "cron"],
  },
  { label: "Agent", tabs: ["agents", "skills", "nodes"] },
  { label: "Settings", tabs: ["personal", "config", "debug", "logs"] },
] as const;

export type Tab =
  | "agents"
  | "overview"
  | "channels"
  | "instances"
  | "sessions"
  | "usage"
  | "cron"
  | "skills"
  | "nodes"
  | "chat"
  | "digital-human"
  | "personal"
  | "config"
  | "debug"
  | "logs";

const TAB_PATHS: Record<Tab, string> = {
  agents: "/agents",
  overview: "/overview",
  channels: "/channels",
  instances: "/instances",
  sessions: "/sessions",
  usage: "/usage",
  cron: "/cron",
  skills: "/skills",
  nodes: "/nodes",
  chat: "/chat",
  "digital-human": "/digital-human",
  personal: "/personal",
  config: "/config",
  debug: "/debug",
  logs: "/logs",
};

const PATH_TO_TAB = new Map(Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]));

export function normalizeBasePath(basePath: string): string {
  if (!basePath) {
    return "";
  }
  let base = basePath.trim();
  if (!base.startsWith("/")) {
    base = `/${base}`;
  }
  if (base === "/") {
    return "";
  }
  if (base.endsWith("/")) {
    base = base.slice(0, -1);
  }
  return base;
}

export function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }
  let normalized = path.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function pathForTab(tab: Tab, basePath = ""): string {
  const base = normalizeBasePath(basePath);
  const path = TAB_PATHS[tab];
  return base ? `${base}${path}` : path;
}

export function tabFromPath(pathname: string, basePath = ""): Tab | null {
  const base = normalizeBasePath(basePath);
  let path = pathname || "/";
  if (base) {
    if (path === base) {
      path = "/";
    } else if (path.startsWith(`${base}/`)) {
      path = path.slice(base.length);
    }
  }
  let normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith("/index.html")) {
    normalized = "/";
  }
  if (normalized === "/") {
    return "chat";
  }
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function inferBasePathFromPathname(pathname: string): string {
  let normalized = normalizePath(pathname);
  if (normalized.endsWith("/index.html")) {
    normalized = normalizePath(normalized.slice(0, -"/index.html".length));
  }
  if (normalized === "/") {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }
  for (let i = 0; i < segments.length; i++) {
    const candidate = `/${segments.slice(i).join("/")}`.toLowerCase();
    if (PATH_TO_TAB.has(candidate)) {
      const prefix = segments.slice(0, i);
      return prefix.length ? `/${prefix.join("/")}` : "";
    }
  }
  return `/${segments.join("/")}`;
}

export function iconForTab(tab: Tab): IconName {
  switch (tab) {
    case "agents":
      return "folder";
    case "chat":
      return "messageSquare";
    case "overview":
      return "barChart";
    case "channels":
      return "link";
    case "instances":
      return "radio";
    case "sessions":
      return "fileText";
    case "usage":
      return "barChart";
    case "cron":
      return "loader";
    case "skills":
      return "zap";
    case "nodes":
      return "monitor";
    case "personal":
      return "user";
    case "config":
      return "settings";
    case "debug":
      return "bug";
    case "logs":
      return "scrollText";
    case "digital-human":
      return "monitor";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab) {
  switch (tab) {
    case "agents":
      return "Agents";
    case "overview":
      return "Overview";
    case "channels":
      return "Channels";
    case "instances":
      return "Instances";
    case "sessions":
      return "Sessions";
    case "usage":
      return "Usage";
    case "cron":
      return "Cron Jobs";
    case "skills":
      return "Skills";
    case "nodes":
      return "Nodes";
    case "chat":
      return "Chat";
    case "personal":
      return t("commands.personalInfo");
    case "config":
      return "Config";
    case "debug":
      return "Debug";
    case "logs":
      return "Logs";
    case "digital-human":
      return "Digital Human";
    default:
      return "Control";
  }
}

/* ─── Command Palette definitions ─── */

export type CommandDefinition = {
  id: string;
  label: string;
  category: string;
  icon: IconName;
  tab?: Tab;
  shortcut?: string;
  keywords: string[];
};

export function getCommandCategories(): [string, string, string] {
  return [t("commands.chat"), t("commands.services"), t("commands.system")];
}

/** @deprecated Use getCommandCategories() for translated output. */
export const COMMAND_CATEGORIES = ["chat", "services", "system"] as const;

export function getCommands(): CommandDefinition[] {
  const chat = t("commands.chat");
  const services = t("commands.services");
  const system = t("commands.system");
  return [
    // Chat
    {
      id: "new-chat",
      label: t("commands.newConversation"),
      category: chat,
      icon: "messageSquare",
      shortcut: "Ctrl+N",
      keywords: ["new", "chat", "会話", "新規"],
    },
    {
      id: "history",
      label: t("commands.conversationHistory"),
      category: chat,
      icon: "fileText",
      tab: "sessions",
      shortcut: "Ctrl+H",
      keywords: ["history", "履歴", "sessions"],
    },
    // Connections & Services
    {
      id: "channels",
      label: t("commands.channelManagement"),
      category: services,
      icon: "link",
      tab: "channels",
      keywords: ["channels", "チャネル", "slack", "discord", "telegram"],
    },
    {
      id: "agents",
      label: t("commands.agentSettings"),
      category: services,
      icon: "folder",
      tab: "agents",
      keywords: ["agents", "エージェント"],
    },
    {
      id: "cron",
      label: t("commands.scheduleManagement"),
      category: services,
      icon: "loader",
      tab: "cron",
      keywords: ["cron", "schedule", "スケジュール"],
    },
    // System
    {
      id: "personal",
      label: t("commands.personalInfo"),
      category: system,
      icon: "user",
      tab: "personal",
      keywords: ["personal", "個人情報", "従業員", "employee", "profile"],
    },
    {
      id: "settings",
      label: t("commands.settings"),
      category: system,
      icon: "settings",
      tab: "config",
      shortcut: "Ctrl+,",
      keywords: ["config", "設定", "settings"],
    },
    {
      id: "overview",
      label: t("commands.dashboard"),
      category: system,
      icon: "barChart",
      tab: "overview",
      keywords: ["overview", "ダッシュボード", "dashboard"],
    },
    {
      id: "usage",
      label: t("commands.checkUsage"),
      category: system,
      icon: "barChart",
      tab: "usage",
      keywords: ["usage", "使用量", "cost", "コスト"],
    },
    {
      id: "skills",
      label: t("commands.skillManagement"),
      category: system,
      icon: "zap",
      tab: "skills",
      keywords: ["skills", "スキル"],
    },
    {
      id: "logs",
      label: t("commands.showLogs"),
      category: system,
      icon: "scrollText",
      tab: "logs",
      keywords: ["logs", "ログ"],
    },
    {
      id: "debug",
      label: t("commands.debug"),
      category: system,
      icon: "bug",
      tab: "debug",
      keywords: ["debug", "デバッグ"],
    },
    {
      id: "nodes",
      label: t("commands.nodeManagement"),
      category: system,
      icon: "monitor",
      tab: "nodes",
      keywords: ["nodes", "ノード"],
    },
    {
      id: "instances",
      label: t("commands.instances"),
      category: system,
      icon: "radio",
      tab: "instances",
      keywords: ["instances", "インスタンス"],
    },
  ];
}

/** @deprecated Use getCommands() for translated output. */
export const COMMANDS: CommandDefinition[] = [];

export function subtitleForTab(tab: Tab) {
  switch (tab) {
    case "agents":
      return "Manage agent workspaces, tools, and identities.";
    case "overview":
      return "Gateway status, entry points, and a fast health read.";
    case "channels":
      return "Manage channels and settings.";
    case "instances":
      return "Presence beacons from connected clients and nodes.";
    case "sessions":
      return "Inspect active sessions and adjust per-session defaults.";
    case "usage":
      return "";
    case "cron":
      return "Schedule wakeups and recurring agent runs.";
    case "skills":
      return "Manage skill availability and API key injection.";
    case "nodes":
      return "Paired devices, capabilities, and command exposure.";
    case "chat":
      return "Direct gateway chat session for quick interventions.";
    case "personal":
      return t("personal.subtitle");
    case "config":
      return "Edit ~/.winclaw/winclaw.json (WinClaw config) safely.";
    case "debug":
      return "Gateway snapshots, events, and manual RPC calls.";
    case "logs":
      return "Live tail of the gateway file logs.";
    case "digital-human":
      return "Real-time voice conversation with your digital human avatar.";
    default:
      return "";
  }
}
