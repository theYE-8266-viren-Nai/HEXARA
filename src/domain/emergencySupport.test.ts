import { describe, expect, it } from "vitest";
import { forEarth, getEmergencySupport, SUPPORT_TOPICS, type EmergencyTopic } from "../../supabase/functions/_shared/emergencySupport";

const examples: Array<[string, EmergencyTopic, string]> = [
  ["I can't breathe", "breathing", "speak, cough, or breathe"],
  ["She is choking", "breathing", "nearby crewmate"],
  ["My chest feels tight", "chest", "Stop exertion"],
  ["His face is drooping", "stroke", "when it began"],
  ["One side is numb", "stroke", "even if it has stopped"],
  ["I'm bleeding heavily", "bleeding", "firm pressure"],
  ["My lips are swelling", "allergy", "emergency allergy plan"],
  ["She is having a seizure", "seizure", "anything in the person's mouth"],
  ["He is unconscious", "unresponsive", "CPR/AED"],
  ["He stopped breathing", "unresponsive", "cannot be woken"],
  ["I swallowed a chemical cleaner", "poisoning", "Do not make the person vomit"],
  ["I took an overdose", "poisoning", "packaging"],
  ["I burned my hand", "burn", "stuck to a burn"],
  ["Someone got an electric shock", "burn", "contact with electricity"],
  ["I hit my head", "injury", "head or neck"],
  ["I have a broken arm", "injury", "unnecessary movement"],
  ["I think it's heatstroke", "temperature", "heat/cold exposure"],
  ["I'm loosing blood sugar", "glucose", "do not use it to treat suspected low blood sugar"],
  ["I'm losing blood sugar", "glucose", "do not use it to treat suspected low blood sugar"],
  ["My glucose is high", "glucose", "does not measure blood glucose"],
  ["The cabin pressure alarm went off", "mission", "specific onboard emergency checklist"],
  ["There's an oxygen leak", "mission", "equipment actions"],
  ["Radiation alarm", "mission", "exposure dose"],
  ["I might hurt myself", "distress", "help staying safe"],
  ["I've been vomiting", "illness", "when they began"],
  ["I'm not feeling well", "check_in", "when did it start"],
  ["Which medication dose should I take?", "medication", "cannot prescribe"],
  ["Unfamiliar emergency condition", "general", "what happened"],
];

describe("conversational support across emergency concerns", () => {
  it.each(examples)("routes %s without diagnosis or model generation", (message, topic, detail) => {
    const reply = getEmergencySupport(message);
    const completeGuidance = `${reply?.content}\n${reply?.details}`;
    expect(reply?.topic).toBe(topic);
    expect(completeGuidance).toContain(detail);
    expect(reply?.content).toMatch(/crew medic|medical support/i);
    expect(completeGuidance).toMatch(/no one has been contacted/i);
    expect(reply?.content).not.toMatch(/(?:^|[.!?]\s+)you have (?:a|an)|inject \d|take \d/i);
    expect(reply!.content.trim().split(/\s+/).length).toBeLessThanOrEqual(30);
    expect(reply!.content.split("\n").length).toBeLessThanOrEqual(3);
  });
  it("offers broad support without claiming exhaustive coverage", () => {
    expect(SUPPORT_TOPICS).toHaveLength(18);
    expect(getEmergencySupport("something is wrong")?.topic).toBe("check_in");
    expect(getEmergencySupport("I've never heard of this, but it's an emergency")?.topic).toBe("general");
    expect(getEmergencySupport("Hello friend")).toBeUndefined();
  });
  it("remembers an urgent conversation for ambiguous follow-ups", () => {
    expect(getEmergencySupport("I'm alone", "bleeding")?.details).toContain("backup mission emergency channel");
    expect(getEmergencySupport("No", "burn")?.topic).toBe("burn");
    expect(getEmergencySupport("It started ten minutes ago", "chest")?.content).toContain("Tell your crew medic what changed");
    expect(getEmergencySupport("What should I tell the medic?", "seizure")?.content).toContain("Never use simulated values");
  });
  it("prioritises a new red flag over the previous symptom conversation", () => {
    expect(getEmergencySupport("Now I can't breathe", "check_in")?.topic).toBe("breathing");
    expect(getEmergencySupport("My lips are swelling and I can't breathe", "glucose")?.topic).toBe("allergy");
    expect(getEmergencySupport("He is unconscious and bleeding", "bleeding")?.topic).toBe("unresponsive");
  });
  it("does not treat reaching a medic or improvement as clearance", () => {
    expect(getEmergencySupport("A medic is with me", "chest")?.content).toContain("cannot confirm safety");
    expect(getEmergencySupport("I feel better", "chest")?.details).toContain("cannot judge whether things are improving");
  });
  it("treats 'no' to 'is the person awake and breathing?' as unresponsive", () => {
    expect(getEmergencySupport("No", "general")?.topic).toBe("unresponsive");
    expect(getEmergencySupport("she isn't breathing", "general")?.topic).toBe("unresponsive");
    expect(getEmergencySupport("I'm alone", "general")?.topic).toBe("general");
  });
  it("routes heat stroke and broken bones to the right topic", () => {
    expect(getEmergencySupport("I think it's heat stroke")?.topic).toBe("temperature");
    expect(getEmergencySupport("I broke my arm")?.topic).toBe("injury");
  });
  it("puts emergency services first on Earth and removes crew-only steps", () => {
    for (const message of ["I need help now", "chest pain", "he collapsed", "I'm choking", "burned my hand", "I want to hurt myself"]) {
      const support = forEarth(getEmergencySupport(message)!);
      const text = `${support.content}\n${support.details}`;
      expect(support.content.split("\n")[0]).toBe("Call emergency services now.");
      expect(text).not.toMatch(/crew ?medic|crewmate|mission control|onboard|Earth:/i);
    }
    expect(forEarth(getEmergencySupport("I'm alone", "chest")!).content).toContain("Call emergency services");
    expect(forEarth(getEmergencySupport("burned my hand")!).details).toContain("Leave material stuck to a burn");
  });
  it("keeps general guidance independent of the glucose-specific correction", () => {
    expect(getEmergencySupport("I'm bleeding")?.content).not.toContain("Insulin");
    expect(getEmergencySupport("I need help now")?.content).not.toContain("blood sugar");
  });
});
