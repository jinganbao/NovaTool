import { describe, expect, it } from "vitest";
import { enabledBodyFields, serializeUrlEncoded } from "./requestSerialization";

describe("HTTP body serialization", () => {
  const fields = [{ id: "1", key: "name", value: "Nova Tool", enabled: true, type: "string" as const }, { id: "2", key: "disabled", value: "x", enabled: false }];
  it("encodes enabled form fields", () => expect(serializeUrlEncoded(fields, (value) => value)).toBe("name=Nova+Tool"));
  it("keeps field metadata for multipart requests", () => expect(enabledBodyFields(fields, (value) => value)).toEqual([{ key: "name", value: "Nova Tool", fieldType: "string", fileData: undefined, fileName: undefined }]));
});
