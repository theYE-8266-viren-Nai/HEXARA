import { describe, expect, it, vi } from "vitest";
import { createWellbeingFeedbackRepository } from "./wellbeingFeedbackRepository";

describe("wellbeing feedback repository", () => {
  it("returns a safe cloud response", async () => {
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: { text: "1. Protect your next sleep period.\n2. Talk with your mission team about workload." }, error: null }) } } as never;
    const result = await createWellbeingFeedbackRepository(client).generate({ stage: "active", headline: "Mostly steady", concern: "watch", lines: ["Sleep was broken."] });
    expect(result.text).toContain("Protect your next sleep period");
  });

  it("does not claim success when cloud feedback fails", async () => {
    const client = { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } }) } } as never;
    const result = await createWellbeingFeedbackRepository(client).generate({ stage: "future", headline: "You seem to be doing well", concern: "steady", lines: ["Mood was steady."] });
    expect(result.text).toBeUndefined();
    expect(result.error).toBe("offline");
  });
});
