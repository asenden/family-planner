import { describe, it, expect } from "vitest";
import { generateInviteCode, isValidInviteCode } from "@/lib/invite-code";

describe("generateInviteCode", () => {
  it("generates a 6-character string", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
  });
  it("uses only uppercase letters and digits", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).toMatch(/^[A-Z0-9]{6}$/);
    }
  });
  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});

describe("isValidInviteCode", () => {
  it("accepts valid 6-char alphanumeric codes", () => {
    expect(isValidInviteCode("ABC123")).toBe(true);
    expect(isValidInviteCode("XYZW99")).toBe(true);
  });
  it("rejects invalid codes", () => {
    expect(isValidInviteCode("abc123")).toBe(false);
    expect(isValidInviteCode("AB12")).toBe(false);
    expect(isValidInviteCode("ABCDEFG")).toBe(false);
    expect(isValidInviteCode("ABC 12")).toBe(false);
    expect(isValidInviteCode("")).toBe(false);
  });
});
