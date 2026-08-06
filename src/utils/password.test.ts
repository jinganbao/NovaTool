import { describe, expect, it } from "vitest";
import { AMBIGUOUS, CHAR_SETS, generatePassword } from "./password";

const base = {
  length: 16,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
};

describe("generatePassword", () => {
  it("长度正确", () => {
    expect(generatePassword({ ...base, length: 8 }).length).toBe(8);
    expect(generatePassword({ ...base, length: 64 }).length).toBe(64);
  });

  it("启用字符集每类至少出现一个", () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generatePassword(base);
      for (const key of ["upper", "lower", "digits", "symbols"] as const) {
        expect(
          [...pwd].some((c) => CHAR_SETS[key].chars.includes(c)),
          `密码缺少 ${key} 类字符: ${pwd}`,
        ).toBe(true);
      }
    }
  });

  it("仅启用的字符集参与", () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generatePassword({ ...base, upper: false, symbols: false });
      const allowed = CHAR_SETS.lower.chars + CHAR_SETS.digits.chars;
      for (const c of pwd) {
        expect(allowed.includes(c), `出现未启用字符: ${c} in ${pwd}`).toBe(true);
      }
    }
  });

  it("避免混淆字符时不含 0O1lI", () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generatePassword(base);
      for (const c of AMBIGUOUS) {
        expect(pwd.includes(c), `出现易混淆字符 ${c}: ${pwd}`).toBe(false);
      }
    }
  });

  it("单字符集(全数字)也能生成", () => {
    const pwd = generatePassword({ ...base, upper: false, lower: false, symbols: false });
    expect(/^\d+$/.test(pwd)).toBe(true);
    expect(pwd.length).toBe(16);
  });

  it("长度上限与下限", () => {
    expect(generatePassword({ ...base, length: 0 }).length).toBe(1);
    expect(generatePassword({ ...base, length: 999 }).length).toBe(128);
  });

  it("每次生成不同", () => {
    const a = generatePassword(base);
    const b = generatePassword(base);
    expect(a).not.toBe(b);
  });

  it("非法输入抛错", () => {
    expect(() =>
      generatePassword({ ...base, upper: false, lower: false, digits: false, symbols: false }),
    ).toThrow();
  });
});
