import { JSONPath } from "jsonpath-plus";

export type QueryMode = "jsonpath" | "xpath";
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function queryJson(input: string, expression: string): unknown[] {
  let data: JsonValue;
  try { data = JSON.parse(input); } catch (error) { throw Object.assign(new Error(`JSON 无效：${error instanceof Error ? error.message : String(error)}`), { cause: error }); }
  const path = expression.trim() || "$";
  try { return JSONPath({ path, json: data, wrap: true }); } catch (error) { throw Object.assign(new Error(`JSONPath 无效：${error instanceof Error ? error.message : String(error)}`), { cause: error }); }
}

function serializeNode(node: Node): string {
  if (node.nodeType === 2) return `${node.nodeName}="${node.nodeValue ?? ""}"`;
  if (node.nodeType === 3) return node.nodeValue?.trim() ?? "";
  return new XMLSerializer().serializeToString(node);
}

function queryXmlFallback(document: Document, path: string): string[] {
  const textPath = path.match(/^\/\/([A-Za-z_][\w:.-]*)\/text\(\)$/);
  if (textPath) {
    return Array.from(document.getElementsByTagName(textPath[1]))
      .map((element) => element.textContent?.trim() ?? "");
  }

  const attributePath = path.match(/^\/\/([A-Za-z_][\w:.-]*)\/@([A-Za-z_][\w:.-]*)$/);
  if (attributePath) {
    return Array.from(document.getElementsByTagName(attributePath[1]))
      .map((element) => element.getAttribute(attributePath[2]))
      .filter((value): value is string => value !== null);
  }

  const elementPath = path.match(/^\/\/([A-Za-z_][\w:.-]*)$/);
  if (elementPath) {
    return Array.from(document.getElementsByTagName(elementPath[1])).map(serializeNode);
  }

  if (path === "/*" && document.documentElement) return [serializeNode(document.documentElement)];
  throw new Error("当前环境不支持此 XPath 表达式");
}

export function queryXml(input: string, expression: string): string[] {
  const document = new DOMParser().parseFromString(input, "application/xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) throw new Error(`XML 无效：${parserError.textContent?.trim() || "无法解析文档"}`);
  const path = expression.trim() || "/*";
  if (typeof document.evaluate !== "function" || typeof XPathResult === "undefined") {
    return queryXmlFallback(document, path);
  }

  const result = document.evaluate(path, document, null, XPathResult.ANY_TYPE, null);
  const values: string[] = [];
  if (result.resultType === XPathResult.BOOLEAN_TYPE) return [String(result.booleanValue)];
  if (result.resultType === XPathResult.NUMBER_TYPE) return [String(result.numberValue)];
  if (result.resultType === XPathResult.STRING_TYPE) return [result.stringValue];
  let node = result.iterateNext();
  while (node) { values.push(serializeNode(node)); node = result.iterateNext(); }
  return values;
}

export function formatQueryResults(mode: QueryMode, values: unknown[] | string[]): string {
  if (mode === "jsonpath") return JSON.stringify(values, null, 2);
  return values.join("\n\n");
}
