import { describe, expect, it } from "vitest";
import { offlineChatReply, stageName } from "./chat";

describe("OrbitWell chat contract", () => {
  it("names each stage in plain language", () => {
    expect(stageName("future")).toBe("Future traveler");
    expect(stageName("active")).toBe("Active astronaut");
    expect(stageName("retired")).toBe("Retired astronaut");
  });

  it("keeps urgent guidance pointed to human mission support", () => {
    const reply = offlineChatReply("active", "I have severe pain");
    expect(reply).toContain("crew medic");
    expect(reply).toContain("Earth: emergency services");
  });
  it("offers a warm built-in retired conversation without assuming an overview effect", () => {
    expect(offlineChatReply("retired", "I miss the view of Earth")).toContain("What part of seeing Earth feels most present today?");
    expect(offlineChatReply("retired", "Life after the mission feels different")).toContain("What feels different for you lately?");
    expect(offlineChatReply("retired", "I want to reconnect with people")).toContain("person you would like to reach out to");
    expect(offlineChatReply("retired", "Hello")).toContain("What would you like to share?");
  });
});
