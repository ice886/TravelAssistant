import { describe, expect, it } from "vitest";

import { budgetOptions, interestOptions, travelerOptions } from "./tripDefaults";

describe("trip defaults", () => {
  it("keeps the workbench form options populated", () => {
    expect(interestOptions.length).toBeGreaterThan(0);
    expect(budgetOptions).toContain("Comfort");
    expect(travelerOptions).toContain("Family");
  });
});
