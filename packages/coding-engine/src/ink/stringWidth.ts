// WinClaw port stub: replace ink's stringWidth with npm string-width.
import stringWidthImpl from "string-width";
export function stringWidth(s: string): number {
  return stringWidthImpl(s);
}
export default stringWidth;
