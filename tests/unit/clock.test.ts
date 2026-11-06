import { afterEach, describe, expect, it } from "vitest";
import { clock } from "../../src/common/clock.js";

describe("Clock utility", () => {
  afterEach(() => {
    clock.reset();
  });

  it("should return the current real date by default", () => {
    const before = new Date().getTime();
    const current = clock.now().getTime();
    const after = new Date().getTime();

    expect(current).toBeGreaterThanOrEqual(before);
    expect(current).toBeLessThanOrEqual(after);
  });

  it("should return mocked date when set", () => {
    const targetDate = new Date("2026-11-06T12:00:00Z");
    clock.setMockTime(targetDate);

    expect(clock.now().toISOString()).toBe("2026-11-06T12:00:00.000Z");
  });

  it("should reset mocked date to real date", () => {
    clock.setMockTime("2020-01-01T00:00:00Z");
    expect(clock.now().getFullYear()).toBe(2020);

    clock.reset();
    expect(clock.now().getFullYear()).toBeGreaterThan(2020);
  });
});

