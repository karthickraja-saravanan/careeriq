import { describe, expect, it } from "vitest";
import { computeYearsOfExperience } from "../src/parsing/experience.js";

const now = new Date(Date.UTC(2026, 10, 10)); // Nov 2026

describe("computeYearsOfExperience", () => {
  it("sums consecutive roles; year-only dates count from mid-year", () => {
    const { years } = computeYearsOfExperience([{ start: "2019", end: "2022" }], now);
    expect(years).toBe(3);
  });
  it("treats 'present' and missing end as now", () => {
    expect(computeYearsOfExperience([{ start: "2024-11", end: "present" }], now).years).toBe(2);
    expect(computeYearsOfExperience([{ start: "2024-11", end: null }], now).years).toBe(2);
  });
  it("does not double count overlapping roles", () => {
    const { years } = computeYearsOfExperience(
      [{ start: "2020-01", end: "2022-01" }, { start: "2021-01", end: "2023-01" }],
      now,
    );
    expect(years).toBe(3);
  });
  it("skips roles it cannot read and reports them", () => {
    const r = computeYearsOfExperience([{ start: "sometime", end: "2022" }, { start: "2021-01", end: "2022-01" }], now);
    expect(r).toEqual({ years: 1, skippedRoles: 1 });
  });
  it("returns null when no dates are usable", () => {
    expect(computeYearsOfExperience([], now).years).toBeNull();
    expect(computeYearsOfExperience([{ start: null, end: null }], now)).toEqual({ years: null, skippedRoles: 1 });
  });
  it("ignores end dates before start dates", () => {
    expect(computeYearsOfExperience([{ start: "2022", end: "2020" }], now).years).toBeNull();
  });
});
