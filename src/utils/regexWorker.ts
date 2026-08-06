/// <reference lib="webworker" />
/**
 * 正则匹配/替换 Worker
 * 将正则执行移出主线程：灾难性回溯可通过 terminate 强制中止，避免冻结 UI。
 * 消息协议：
 *   { seq, type: "match", pattern, flags, text, maxResults } -> { seq, ok, matches, decorations, truncated }
 *   { seq, type: "replace", pattern, flags, text, replaceWith } -> { seq, ok, replaced }
 *   失败: { seq, ok: false, error }
 */

interface MatchResult {
  index: number;
  text: string;
  length: number;
  groups: Record<string, string>;
}

interface LineDecoration {
  from: number;
  to: number;
  class: string;
}

interface WorkerRequest {
  seq: number;
  type: "match" | "replace";
  pattern: string;
  flags: string;
  text: string;
  maxResults?: number;
  replaceWith?: string;
}

// DOM lib 与 WebWorker lib 并存，self 需显式断言为 Worker 全局对象
const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

/** 返回第一个 lineStarts[i] > pos 的索引（lineStarts 为每行起始偏移） */
function firstLineGreaterThan(lineStarts: number[], pos: number): number {
  let lo = 0;
  let hi = lineStarts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lineStarts[mid] <= pos) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** 计算匹配结果与行级装饰（行号 1-based） */
function computeMatch(
  re: RegExp,
  text: string,
  maxResults: number,
): { matches: MatchResult[]; decorations: LineDecoration[]; truncated: boolean } {
  const matches: MatchResult[] = [];
  const decorations: LineDecoration[] = [];

  // 预构建行起始偏移，用二分定位匹配所在行，避免每个匹配都全量扫行
  const lines = text.split("\n");
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  const reGlobal = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");

  let m: RegExpExecArray | null;
  while ((m = reGlobal.exec(text)) !== null) {
    matches.push({
      index: m.index,
      text: m[0],
      length: m[0].length,
      groups: m.groups || {},
    });

    // 匹配涉及的行区间 [startLine, endLine]（0-based）
    const matchEnd = m.index + m[0].length;
    const startLine = firstLineGreaterThan(lineStarts, m.index) - 1;
    const endLine = firstLineGreaterThan(lineStarts, matchEnd - 1) - 1;
    for (let i = Math.max(0, startLine); i <= endLine && i < lines.length; i++) {
      decorations.push({ from: i + 1, to: i + 1, class: "regex-match" });
    }

    if (!re.flags.includes("g")) break;
    if (matches.length >= maxResults) {
      return { matches, decorations, truncated: true };
    }
  }

  return { matches, decorations, truncated: false };
}

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { seq, type, pattern, flags, text } = e.data;

  const reply = (data: Record<string, unknown>) => {
    ctx.postMessage({ seq, ...data });
  };

  try {
    const re = new RegExp(pattern, flags);

    if (type === "match") {
      const maxResults = e.data.maxResults ?? 5000;
      const { matches, decorations, truncated } = computeMatch(re, text, maxResults);
      reply({ ok: true, matches, decorations, truncated });
      return;
    }

    // replace
    const reWithG = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    // 替换结果上限，防止海量零宽匹配 + 大替换串膨胀出 GB 级字符串。
    // 最坏情况估算：每个字符处都可能产生零宽匹配（最多 text.length + 1 个），
    // 在真正构建结果串之前预检，避免构建过程中 OOM。
    const MAX_REPLACE_RESULT_CHARS = 16 * 1024 * 1024;
    const replaceWith = e.data.replaceWith ?? "";
    const worstCaseLen = text.length + (text.length + 1) * replaceWith.length;
    if (worstCaseLen > MAX_REPLACE_RESULT_CHARS) {
      reply({
        ok: false,
        error: `替换组合过大（文本 × 替换内容最坏可达 ${(worstCaseLen / 1024 / 1024).toFixed(1)}MB），请缩短替换内容或缩小文本`,
      });
      return;
    }
    const replaced = text.replace(reWithG, replaceWith);
    if (replaced.length > MAX_REPLACE_RESULT_CHARS) {
      reply({
        ok: false,
        error: `替换结果过大（超过 ${MAX_REPLACE_RESULT_CHARS / 1024 / 1024}MB），请缩短替换内容或缩小文本`,
      });
      return;
    }
    reply({ ok: true, replaced });
  } catch (err) {
    reply({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
