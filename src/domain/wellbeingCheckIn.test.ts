import { describe, expect, it } from "vitest";
import { checkInQuestions, summarizeCheckIn, visibleQuestions } from "./wellbeingCheckIn";
import type { LifeStage } from "../types/horizon";

const stages: LifeStage[] = ["future", "active", "retired"];

describe("wellbeing check-in", () => {
  it("asks each stage its own questions", () => {
    const prompts = stages.map((stage) => checkInQuestions(stage).map((question) => question.prompt));
    expect(prompts[0]).toContain("How does your body feel after your latest training session?");
    expect(prompts[1]).toContain("How manageable does today's workload feel?");
    expect(prompts[2]).toContain("How does life after flying feel right now?");
    expect(prompts[0]).not.toContain("How manageable does today's workload feel?");
    expect(prompts[2]).not.toContain("How are things with the crew right now?");
  });

  it("only asks what got in the way of sleep when sleep was poor", () => {
    expect(visibleQuestions("active", { sleep: "rested" }).map((q) => q.id)).not.toContain("sleepFactors");
    expect(visibleQuestions("active", { sleep: "tired" }).map((q) => q.id)).toContain("sleepFactors");
  });

  it("reads as steady when every answer is positive", () => {
    for (const stage of stages) {
      const answers = Object.fromEntries(checkInQuestions(stage).filter((q) => !q.multi).map((q) => [q.id, q.options[0].id]));
      const summary = summarizeCheckIn(stage, answers);
      expect(summary.overall).toBe("steady");
      expect(summary.talkTo).toBeUndefined();
      expect(summary.headline).toBe("You seem to be doing well today.");
      expect(summary.suggestions[0].title).toBe("Keep your routine going");
    }
  });

  it("explains poor sleep with the chosen causes and suggests something specific", () => {
    const summary = summarizeCheckIn("active", { sleep: "tired", sleepFactors: ["noise", "light"], energy: "full" });
    expect(summary.overall).toBe("watch");
    expect(summary.lines[0].text).toBe("Your sleep on board was broken and you still feel tired, mostly because of noise and light.");
    expect(summary.suggestions.map((item) => item.title)).toContain("Protect your next sleep period");
    expect(summary.headline).toBe("Mostly steady, with a few things to look after.");
  });

  it("points to the right person for each stage when pain or a very low mood is reported", () => {
    expect(summarizeCheckIn("active", { body: "worsening" }).talkTo).toContain("crew medic or flight surgeon");
    expect(summarizeCheckIn("future", { recovery: "injury" }).talkTo).toContain("training physician or instructor");
    expect(summarizeCheckIn("retired", { mood: "low" }).talkTo).toContain("your doctor");
    expect(summarizeCheckIn("retired", { mood: "low" }).overall).toBe("hard");
    expect(summarizeCheckIn("retired", { mood: "low" }).headline).toBe("Today looks hard. You don't have to handle it alone.");
  });

  it("never uses diagnostic wording", () => {
    for (const stage of stages) {
      const worst = Object.fromEntries(checkInQuestions(stage).filter((q) => !q.multi).map((q) => [q.id, q.options[q.options.length - 1].id]));
      const text = JSON.stringify(summarizeCheckIn(stage, worst));
      expect(text).not.toMatch(/diagnos(is|ed)|depress|disorder|insomnia/i);
    }
  });
});
