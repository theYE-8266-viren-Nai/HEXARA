import { describe, expect, it } from "vitest";
import { offlineChatReply, stageName } from "./chat";

describe("Horizon chat contract", () => {
  it("names each stage in plain language", () => {
    expect(stageName("future")).toBe("Future traveler");
    expect(stageName("active")).toBe("Active astronaut");
    expect(stageName("retired")).toBe("Retired astronaut");
  });

  it("keeps urgent guidance pointed to human mission support", () => {
    const reply = offlineChatReply("active", "I have severe pain");
    expect(reply).toContain("crew medic");
    expect(reply).toMatch(/cannot diagnose|not medical advice/i);
  });
});
