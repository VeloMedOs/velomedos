// @ts-expect-error bun-types conflicts with project types
import { describe, it, expect } from "bun:test";
import { encodeStructuredNotes, STRUCTURED_KEYS } from "@/components/marketing/BusinessIntakeModal";

describe("BusinessIntakeModal — structured prefix encoding", () => {
  it("prefixes structured fields into notes with key: value lines", () => {
    const out = encodeStructuredNotes("Hospital in Riyadh", {
      business_type: "hospital",
      current_HIS: "none",
      target_go_live: "2026Q4",
      whitelabel_interest: "yes",
      interested_modules: "opd,ipd,rcm",
    });
    expect(out).toContain("business_type: hospital");
    expect(out).toContain("current_HIS: none");
    expect(out).toContain("target_go_live: 2026Q4");
    expect(out).toContain("whitelabel_interest: yes");
    expect(out).toContain("interested_modules: opd,ipd,rcm");
    expect(out.endsWith("Hospital in Riyadh")).toBe(true);
  });

  it("returns freeform-only when no structured fields are set", () => {
    const out = encodeStructuredNotes("Just a note", {
      business_type: "", current_HIS: "", target_go_live: "",
      whitelabel_interest: "", interested_modules: "",
    });
    expect(out).toBe("Just a note");
  });

  it("only encodes the ratified key set", () => {
    expect([...STRUCTURED_KEYS].sort()).toEqual(
      ["business_type", "current_HIS", "interested_modules", "target_go_live", "whitelabel_interest"].sort(),
    );
  });
});