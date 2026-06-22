// WinClaw port real-stub for @anthropic-ai/sandbox-runtime: sandbox fully disabled headless.
const violationStore = { add() {}, list() { return []; }, clear() {} };
export const SandboxManager = {
  checkDependencies: async () => ({ ok: true, missing: [] as string[] }),
  isSupportedPlatform: () => false,
  isSandboxingEnabled: () => false,
  isAutoAllowBashIfSandboxedEnabled: () => false,
  areUnsandboxedCommandsAllowed: () => true,
  wrapWithSandbox: (_cfg: unknown, cmd: unknown) => cmd,
  annotateStderrWithSandboxFailures: (stderr: unknown) => stderr,
  cleanupAfterCommand: async () => {},
  waitForNetworkInitialization: async () => {},
  initialize: async () => {},
  updateConfig: (_c: unknown) => {},
  reset: () => {},
  getFsReadConfig: () => undefined,
  getFsWriteConfig: () => undefined,
  getNetworkRestrictionConfig: () => undefined,
  getIgnoreViolations: () => false,
  getAllowUnixSockets: () => true,
  getAllowLocalBinding: () => true,
  getEnableWeakerNestedSandbox: () => false,
  getProxyPort: () => undefined,
  getSocksProxyPort: () => undefined,
  getLinuxHttpSocketPath: () => undefined,
  getLinuxSocksSocketPath: () => undefined,
  getSandboxViolationStore: () => violationStore,
};
export const SandboxRuntimeConfigSchema = { parse: (x: unknown) => x, safeParse: (x: unknown) => ({ success: true, data: x }) };
export class SandboxViolationStore {
  add() {}
  list() { return []; }
  clear() {}
}
