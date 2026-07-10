/**
 * @fileoverview music-search — 自包含の音乐搜索/播放URL解决モジュール(内蔵 bundle・docs/20 §4.0)。
 *
 * winclaw 节点(Node.js)内で完結する。ブラウザではなく node で叩くので CORS 無し・
 * Referer 自由設定可 → ai-meta 后端は不要。GDStudio 聚合 API(music-api.gdstudio.xyz)を
 * 音源に使い、**netease → joox** の順にフォールバックする(P0 実測・2026-07-07):
 *   - netease: 可播放 m701/m801.music.126.net の直 MP3(320k)。偶に限流で 0 件。
 *   - joox:    hk.stream.music.joox.com の直 MP3。全テスト命中で最も安定(繁体正版)。
 *   - kuwo:    検索は正確だが url-api が空 → 播放不可のため使わない。
 *   - 百度:    tingapi 失効(500)。用户要望の主力だが死んでいるため不採用。
 *
 * ★版权=テスト/PoC 前提(直リンク再生)。商用化時は正規ライセンス音源へ差替。
 *
 * すべて外部モジュール依存なし(Node18+ の global fetch のみ)。差替可能な単一 API を露出:
 *   - {@link searchMusic}(artist, song)     → best-match 1 曲(playUrl 付)or null
 *   - {@link recommendMusic}(artist, exclude) → 同歌手の別曲 1 曲(兜底提案用)or null
 */

/** 解決済みの再生可能トラック(playUrl は必ず non-empty http)。 */
export interface MusicTrack {
  title: string;
  artist: string;
  playUrl: string;
  cover?: string;
  source: string;
  /** 生の songid(デバッグ/再解決用)。 */
  id: string;
}

/** GDStudio 検索の生レコード(必要フィールドのみ)。 */
interface RawTrack {
  id: string | number;
  name: string;
  artist: string[];
  album?: string;
  pic_id?: string | number;
  source?: string;
}

const GD_API = "https://music-api.gdstudio.xyz/api.php";
/** 音源(並行に引き最初に再生可能を返した物を採る)。実測で netease/joox が主力
 *  (周杰伦等は netease で版権ロック→joox で命中)。kuwo/tencent/migu は playUrl を
 *  返す曲もある為 **多源化**して命中率を上げる(2026-07-10・ユーザ要件「多音乐搜索」)。
 *  死んだ源は null を返すだけ(firstNonNull が有効源を採る)。 */
const SOURCES = ["netease", "joox", "kuwo", "tencent", "migu"] as const;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** fetch に UA/Referer を付け、タイムアウト付きで JSON を取る(失敗は null)。
 *  ★A(docs/20 灵敏化): 既定 12s→5s。未命中/hang 時の待ちを短縮し「没找到」を早く返す。 */
async function gdFetchJson(url: string, timeoutMs = 5_000): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "*/*", Referer: "https://music.gdstudio.xyz/" },
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 1 音源で検索(生レコード配列。失敗/空は [])。 */
async function gdSearch(source: string, keyword: string, count = 15): Promise<RawTrack[]> {
  const url = `${GD_API}?types=search&source=${source}&name=${encodeURIComponent(
    keyword,
  )}&count=${count}&pages=1`;
  const data = await gdFetchJson(url);
  if (!Array.isArray(data)) return [];
  return data
    .filter((r): r is RawTrack => !!r && typeof r === "object")
    .map((r) => ({
      id: (r as RawTrack).id,
      name: String((r as RawTrack).name ?? ""),
      artist: Array.isArray((r as RawTrack).artist)
        ? (r as RawTrack).artist.map((a) => String(a))
        : [],
      album: (r as RawTrack).album,
      pic_id: (r as RawTrack).pic_id,
      source: (r as RawTrack).source ?? source,
    }));
}

/** songid → 再生 URL(空/失敗は null)。br=320 優先。 */
async function gdPlayUrl(source: string, id: string | number, br = 320): Promise<string | null> {
  const url = `${GD_API}?types=url&source=${source}&id=${id}&br=${br}`;
  const data = await gdFetchJson(url);
  if (!data || typeof data !== "object") return null;
  const u = (data as { url?: unknown }).url;
  return typeof u === "string" && u.startsWith("http") ? u : null;
}

/** pic_id → 封面 URL(best-effort。失敗は undefined)。 */
async function gdCover(source: string, picId?: string | number): Promise<string | undefined> {
  if (picId === undefined || picId === null || picId === "") return undefined;
  const data = await gdFetchJson(`${GD_API}?types=pic&source=${source}&id=${picId}&size=300`, 6_000);
  if (!data || typeof data !== "object") return undefined;
  const u = (data as { url?: unknown }).url;
  return typeof u === "string" && u.startsWith("http") ? u : undefined;
}

/** 文字列正規化(記号除去・小文字化・全半角空白除去)。照合用。 */
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[《》【】「」（）()\[\]・,，.。~-]/g, "");
}

/** 候補が どれだけ (artist, song) に一致するかスコア化(高いほど良い)。 */
function scoreCandidate(cand: RawTrack, artist: string, song: string): number {
  const nSong = norm(song);
  const nName = norm(cand.name);
  const nArtist = norm(artist);
  const candArtists = cand.artist.map(norm);
  let score = 0;
  // 曲名一致(完全 > 前方 > 包含)
  if (nSong && nName === nSong) score += 100;
  else if (nSong && (nName.startsWith(nSong) || nSong.startsWith(nName))) score += 70;
  else if (nSong && (nName.includes(nSong) || nSong.includes(nName))) score += 45;
  // 歌手一致
  if (nArtist) {
    if (candArtists.some((a) => a === nArtist)) score += 60;
    else if (candArtists.some((a) => a.includes(nArtist) || nArtist.includes(a))) score += 35;
  }
  // Live/DJ版/伴奏 などは減点(原曲優先)
  if (/(live|dj|伴奏|remix|翻自|翻唱|cover|纯音乐|純音樂|演唱会|演唱會|重制|重製|mix)/i.test(cand.name)) {
    score -= 25;
  }
  return score;
}

/** per-source 全体タイムアウト(hang した音源が全体を止めないように)。 */
const SOURCE_TIMEOUT_MS = 8_000;

/** hang 対策の全体タイムアウト付きラッパ(失敗/超時は null)。 */
function withSourceTimeout(p: Promise<MusicTrack | null>): Promise<MusicTrack | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), SOURCE_TIMEOUT_MS)),
  ]);
}

/** 複数音源の Promise 群から **最初に非 null を返したもの** を採る。全 null なら null。
 *  ★A: 直列待ちを避け、命中は最速で返し、未命中は全音源が尽きた時のみ null。 */
function firstNonNull(promises: Promise<MusicTrack | null>[]): Promise<MusicTrack | null> {
  return new Promise((resolve) => {
    let remaining = promises.length;
    let settled = false;
    if (remaining === 0) return resolve(null);
    for (const p of promises) {
      p.then((r) => {
        if (settled) return;
        if (r) {
          settled = true;
          resolve(r);
        } else if (--remaining === 0) {
          resolve(null);
        }
      }).catch(() => {
        if (!settled && --remaining === 0) resolve(null);
      });
    }
  });
}

/** 1 音源で (artist, song) の best-match 再生可能曲を解決(無ければ null)。 */
async function resolveTrackFromSource(source: string, a: string, s: string): Promise<MusicTrack | null> {
  const raw = await gdSearch(source, s);
  if (raw.length === 0) return null;
  const ranked = raw
    .map((c) => ({ c, sc: scoreCandidate(c, a, s) }))
    .filter((x) => x.sc > 0)
    .sort((x, y) => y.sc - x.sc);
  // 上位 3 件だけ playUrl を試す(空 URL を返す音源対策・高速化で 4→3)。
  for (const { c } of ranked.slice(0, 3)) {
    const playUrl = await gdPlayUrl(source, c.id);
    if (!playUrl) continue;
    const cover = await gdCover(source, c.pic_id);
    return { title: c.name, artist: c.artist.join("/") || a, playUrl, cover, source, id: String(c.id) };
  }
  return null;
}

/** 1 音源で歌手の別曲を 1 曲提案(excludeTitle 除外)。無ければ null。 */
async function recommendFromSource(
  source: string,
  a: string,
  nEx: string,
  nArtist: string,
): Promise<MusicTrack | null> {
  const raw = await gdSearch(source, a, 20);
  if (raw.length === 0) return null;
  const pool = raw.filter((c) => norm(c.name) !== nEx);
  const strict = pool.filter((c) =>
    c.artist.map(norm).some((x) => x === nArtist || x.includes(nArtist) || nArtist.includes(x)),
  );
  const ranked = (strict.length ? strict : pool)
    .map((c) => ({ c, sc: scoreCandidate(c, a, "") }))
    .sort((x, y) => y.sc - x.sc);
  for (const { c } of ranked.slice(0, 5)) {
    const playUrl = await gdPlayUrl(source, c.id);
    if (!playUrl) continue;
    const cover = await gdCover(source, c.pic_id);
    return { title: c.name, artist: c.artist.join("/") || a, playUrl, cover, source, id: String(c.id) };
  }
  return null;
}

/**
 * artist(任意)+ song で best-match の 1 曲を解決する。
 * ★A: netease/joox を **並行**に引き、最初に再生可能曲を返した音源を採る。全滅で null。
 * 未命中の待ちを直列 ~24s+ → 並行 ~8s(SOURCE_TIMEOUT_MS)へ短縮する。
 */
export async function searchMusic(artist: string, song: string): Promise<MusicTrack | null> {
  const a = (artist || "").trim();
  const s = (song || "").trim();
  if (!s) return null;
  return firstNonNull(
    SOURCES.map((src) => withSourceTimeout(resolveTrackFromSource(src, a, s))),
  );
}

/**
 * 同歌手の別曲を 1 曲提案する(兜底用)。excludeTitle と同名は除外。
 * ★A: 音源を並行に引き、最初の再生可能曲を返す。無ければ null。
 */
export async function recommendMusic(artist: string, excludeTitle = ""): Promise<MusicTrack | null> {
  const a = (artist || "").trim();
  if (!a) return null;
  const nEx = norm(excludeTitle);
  const nArtist = norm(a);
  return firstNonNull(
    SOURCES.map((src) => withSourceTimeout(recommendFromSource(src, a, nEx, nArtist))),
  );
}
