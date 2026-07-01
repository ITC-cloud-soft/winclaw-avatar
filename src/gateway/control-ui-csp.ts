export function buildControlUiCspHeader(): string {
  // Control UI: block framing, keep styles permissive
  // (UI uses a lot of inline style attributes in templates).
  // ByteRTC SDK needs connect-src for *.rtcplus.com telemetry and
  // *.byteplus.com / *.volcengine.com for signalling servers.
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self' 'unsafe-eval' blob: data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    // 数字人秘书 A案 身份桥(docs/10 §14.5): 節点 DH UI(secretary-panel)が ai-meta の
    // /files /tasks REST を叩けるよう、ローカル ai-meta(localhost/127.0.0.1 任意ポート)を許可。
    // 本番リモートは ai-meta 公網 host を明示追加(§13.4 方案Q)。
    "connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:* https://*.rtcplus.com https://*.byteplus.com https://*.volcengine.com https://*.volces.com",
  ].join("; ");
}
