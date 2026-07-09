// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";

// Mirror the view CASE for masked_ref: NULL → NULL, else '***-' + right(ref,3)
function maskRef(ref: string | null): string | null {
  if (ref === null || ref === undefined) return null;
  return "***-" + ref.slice(-3);
}

describe("v_preauth_mid masking (LL1)", () => {
  it("'ABC12345' → '***-345'", () => {
    expect(maskRef("ABC12345")).toBe("***-345");
  });
  it("NULL → NULL", () => {
    expect(maskRef(null)).toBe(null);
  });
});