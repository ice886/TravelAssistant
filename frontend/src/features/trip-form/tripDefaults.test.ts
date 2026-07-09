import { describe, expect, it } from "vitest";

import { budgetOptions, interestOptions, travelerOptions } from "./tripDefaults";

describe("trip defaults", () => {
  it("keeps the workbench form options populated", () => {
    expect(interestOptions.length).toBeGreaterThan(0);
    expect(budgetOptions).toContain("舒适");
    expect(travelerOptions).toContain("家庭");
  });
});
