/**
 * Turn 2a — meaning-validation, MAP compute, pregnancy-mandatory unit tests.
 * Covers DoD C6 acceptance items 5-7.
 */
// @ts-expect-error — bun-types conflict shared with billed-gate.test.ts
import { describe, expect, it } from "bun:test";
import {
  meaningInvalid,
  validateMandatoryMeaning,
  computeMAP,
  isPregnancyMandatory,
} from "./form-validation";

describe("meaningInvalid", () => {
  it("rejects lone period", () => expect(meaningInvalid(".")).toBe(true));
  it("rejects blank string", () => expect(meaningInvalid("   ")).toBe(true));
  it("rejects double punctuation", () => expect(meaningInvalid("./")).toBe(true));
  it("rejects long punctuation-only string", () => expect(meaningInvalid("!!! ...")).toBe(true));
  it("accepts a single letter", () => expect(meaningInvalid("A")).toBe(false));
  it("accepts real clinical text", () => expect(meaningInvalid("Chest pain, radiates left arm")).toBe(false));
});

describe("validateMandatoryMeaning", () => {
  const fields = [
    { id: "indication", label: "Indication", type: "text", required: true },
    { id: "note", label: "Note", type: "text", required: false },
    { id: "consent", type: "boolean", required: true },
  ];
  it("returns MEANING_INVALID for lone period", () => {
    const issues = validateMandatoryMeaning({ indication: "." }, fields);
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("indication");
  });
  it("passes with meaningful text", () => {
    const issues = validateMandatoryMeaning({ indication: "Septic shock" }, fields);
    expect(issues).toHaveLength(0);
  });
  it("skips non-required and non-string fields", () => {
    const issues = validateMandatoryMeaning({ indication: "OK", note: "." }, fields);
    expect(issues).toHaveLength(0);
  });
});

describe("computeMAP", () => {
  it("returns null when SBP missing", () => expect(computeMAP(null, 80)).toBeNull());
  it("returns null when DBP missing", () => expect(computeMAP(120, null)).toBeNull());
  it("computes when both present", () => expect(computeMAP(120, 80)).toBe(93));
  it("returns null on non-positive values", () => expect(computeMAP(0, 80)).toBeNull());
});

describe("isPregnancyMandatory", () => {
  it("triggers for female 15-55", () => {
    expect(isPregnancyMandatory("female", 15)).toBe(true);
    expect(isPregnancyMandatory("female", 55)).toBe(true);
    expect(isPregnancyMandatory("female", 30)).toBe(true);
  });
  it("skips outside band", () => {
    expect(isPregnancyMandatory("female", 14)).toBe(false);
    expect(isPregnancyMandatory("female", 56)).toBe(false);
  });
  it("skips males", () => expect(isPregnancyMandatory("male", 30)).toBe(false));
  it("skips when age unknown", () => expect(isPregnancyMandatory("female", null)).toBe(false));
});