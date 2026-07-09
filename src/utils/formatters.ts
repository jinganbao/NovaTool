export function formatJson(source: string, space: number) {
  const parsed = JSON.parse(source);
  return JSON.stringify(parsed, null, space);
}

export function compressXml(source: string) {
  return source.replace(/>\s+</g, "><").trim();
}

export function formatXml(source: string) {
  const clean = source.trim();
  if (!clean) return "";
  const parser = new DOMParser();
  const document = parser.parseFromString(clean, "application/xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) throw new Error(parserError.textContent?.trim() || "XML 语法错误");

  const tokens = clean.replace(/>\s*</g, "><").replace(/</g, "\n<").trim().split("\n");
  let depth = 0;
  return tokens
    .map((token) => {
      const trimmed = token.trim();
      if (/^<\/.+>/.test(trimmed)) depth = Math.max(depth - 1, 0);
      const line = `${"  ".repeat(depth)}${trimmed}`;
      if (/^<[^!?/][^>]*[^/]?>$/.test(trimmed) && !trimmed.includes("</")) depth += 1;
      return line;
    })
    .join("\n");
}
