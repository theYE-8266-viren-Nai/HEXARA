import { describe, expect, it } from "vitest";
import { classifyOrbitQuestion, faqsForStage } from "./orbitFaq";

describe("ORBIT FAQ taxonomy", () => {
  it("classifies representative questions without blocking unknown topics", () => {
    expect(classifyOrbitQuestion("How does microgravity affect sleep?")).toBe("health_human_spaceflight");
    expect(classifyOrbitQuestion("Why does the ISS use control moment gyroscopes?")).toBe("missions_engineering");
    expect(classifyOrbitQuestion("Tell me something NASA has not indexed")).toBe("unclassified");
  });

  it("offers different stage-specific preparation cards", () => {
    expect(faqsForStage("future").some((faq) => faq.category === "future_preparation")).toBe(true);
    expect(faqsForStage("active").some((faq) => faq.category === "active_mission_support")).toBe(true);
    expect(faqsForStage("retired").some((faq) => faq.category === "retired_follow_up")).toBe(true);
  });
});
