import { describe, expect, it } from "vitest";
import { formatQueryResults, queryJson, queryXml } from "./queryService";

describe("structured query service", () => {
  it("queries JSON with JSONPath", () => {
    expect(queryJson('{"users":[{"name":"A"},{"name":"B"}]}', "$.users[*].name")).toEqual(["A", "B"]);
    expect(formatQueryResults("jsonpath", ["A", "B"])).toBe('[\n  "A",\n  "B"\n]');
  });

  it("queries XML with XPath", () => {
    expect(queryXml("<root><item>A</item><item>B</item></root>", "//item/text()")).toEqual(["A", "B"]);
  });
});
