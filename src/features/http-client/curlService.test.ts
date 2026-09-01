import { describe, expect, it } from "vitest";
import { buildCurl, parseCurl } from "./curlService";

describe("curl service", () => {
  it("解析常见的 GET cURL", () => {
    const result = parseCurl("curl 'https://example.com/users?page=2' -H 'Accept: application/json'");
    expect(result.method).toBe("GET");
    expect(result.url).toBe("https://example.com/users");
    expect(result.query?.[0]).toMatchObject({ key: "page", value: "2" });
    expect(result.headers?.[0]).toMatchObject({ key: "Accept", value: "application/json" });
  });

  it("解析 POST body 并生成可复用命令", () => {
    const result = parseCurl("curl -X POST https://example.com/api -H 'Content-Type: application/json' --data-raw '{\"name\":\"Nova\"}'");
    expect(result.method).toBe("POST");
    expect(result.bodyType).toBe("json");
    expect(buildCurl({ method: "POST", url: "https://example.com/api", query: [], headers: result.headers ?? [], body: result.body ?? "", bodyType: "json", timeoutMs: 15000 })).toContain("--data-raw");
  });

  it("保留特殊字符并正确编码 Query 参数", () => {
    const result = parseCurl("curl https://example.com/search?q=hello%20world&tag=a%2Bb");
    expect(result.query).toEqual([
      expect.objectContaining({ key: "q", value: "hello world" }),
      expect.objectContaining({ key: "tag", value: "a+b" }),
    ]);
    expect(buildCurl({
      method: "GET",
      url: result.url ?? "",
      query: result.query ?? [],
      headers: [],
      body: "",
      bodyType: "none",
      timeoutMs: 15000,
    })).toContain("q=hello+world");
  });

  it("拒绝没有 URL 的命令", () => {
    expect(() => parseCurl("curl --request GET")).toThrow("没有找到 URL");
  });
});
