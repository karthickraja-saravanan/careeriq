import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

describe("loadEnv", () => {
  it("applies defaults", () => {
    const env = loadEnv({ DATABASE_URL: "postgres://u:p@localhost:5432/db" });
    expect(env.PORT).toBe(3001);
  });
  it("fails fast with a readable message when DATABASE_URL is missing", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });
});
