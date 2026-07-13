// @ts-expect-error bun-types conflicts with project types
import { describe, it, expect } from "bun:test";
import { readDemoVideosEnabled } from "@/lib/platform-settings.functions";

describe("platform_settings.demo_videos_enabled jsonb access", () => {
  it("reads .value.enabled from the jsonb wrapper shape", () => {
    expect(readDemoVideosEnabled({ enabled: true })).toBe(true);
    expect(readDemoVideosEnabled({ enabled: false })).toBe(false);
  });
  it("does not treat the bare wrapper as truthy — must inspect .enabled", () => {
    // If a caller wrongly did `Boolean(value)`, `{ enabled: false }` would
    // return true. The reader must return false.
    expect(readDemoVideosEnabled({ enabled: false })).toBe(false);
  });
  it("falls back to bare boolean for legacy rows without the wrapper", () => {
    expect(readDemoVideosEnabled(true)).toBe(true);
    expect(readDemoVideosEnabled(false)).toBe(false);
    expect(readDemoVideosEnabled(null)).toBe(false);
    expect(readDemoVideosEnabled(undefined)).toBe(false);
  });
});