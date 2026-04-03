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
    "connect-src 'self' ws: wss: https://*.rtcplus.com https://*.byteplus.com https://*.volcengine.com https://*.volces.com",
  ].join("; ");
}
