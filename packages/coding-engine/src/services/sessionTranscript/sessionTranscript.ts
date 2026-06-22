/**
 * Stub: Session transcript writer.
 * In a real implementation this writes segments of the session transcript
 * to disk for KAIROS features (send-file, push-notifications, etc.).
 */

export async function writeSessionTranscriptSegment(
  _messages: unknown[],
): Promise<void> {
  // Stub: no-op
}

export function flushOnDateChange(
  _messages: unknown[],
  _currentDate: string,
): void {
  // Stub: no-op
}
