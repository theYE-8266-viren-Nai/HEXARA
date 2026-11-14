import { describe, expect, it } from "vitest";
import { isHealthQuestion, NO_EVIDENCE_TEXT, parseGeneralHealthAnswer, parseGroundedAnswer, sanitizedNasaQuery } from "../../supabase/functions/_shared/nasaGrounding";
import { getUrgentSupport } from "../../supabase/functions/_shared/emergencySupport";

describe("NASA grounding contract", () => {
  it("accepts only cited answers whose source ids were retrieved", () => {
    expect(parseGroundedAnswer('{"answer":"NASA reports a documented effect. [1]","citationIds":["nasa-source"]}', ["nasa-source"])).toEqual({ answer: "NASA reports a documented effect. [1]", keyPoints: [], nextSteps: [], warnings: [], questionsToExplore: [], confidence: "medium", citationIds: ["nasa-source"] });
    expect(parseGroundedAnswer('{"answer":"Unsupported. [1]","citationIds":["invented"]}', ["nasa-source"])).toBeUndefined();
    expect(parseGroundedAnswer('{"answer":"See https://example.com [1]","citationIds":["nasa-source"]}', ["nasa-source"])).toBeUndefined();
  });
  it("normalises free-model citation styles and trims over-long lists instead of rejecting", () => {
    const parsed = parseGroundedAnswer('Here is the JSON:\n{"answer":"Bone mineral density declines in microgravity【1】 and exercise helps [1, 2].","keyPoints":["' + "x".repeat(400) + '","Exercise is a countermeasure [2]"],"citationIds":["a","b"]}', ["a", "b"]);
    expect(parsed?.answer).toBe("Bone mineral density declines in microgravity[1] and exercise helps [1][2].");
    expect(parsed?.keyPoints).toEqual(["Exercise is a countermeasure [2]"]);
    expect(parseGroundedAnswer('{"answer":"NASA documents bone loss in flight.","citationIds":["a"]}', ["a"])?.answer).toBe("NASA documents bone loss in flight. [1]");
    expect(parseGroundedAnswer('{"answer":"Unsupported [3].","citationIds":["a"]}', ["a"])).toBeUndefined();
  });
  it("allows the exact no-evidence response without citations", () => {
    expect(parseGroundedAnswer(JSON.stringify({ answer: NO_EVIDENCE_TEXT, citationIds: [] }), [])).toEqual({ answer: NO_EVIDENCE_TEXT, keyPoints: [], nextSteps: [], warnings: [], questionsToExplore: [], confidence: "low", citationIds: [] });
  });
  it("keeps EcoLink-style structured fields tied to retrieved citations", () => {
    const parsed = parseGroundedAnswer(JSON.stringify({ answer: "Microgravity changes orientation cues. [1]", keyPoints: ["NASA studies vestibular adaptation. [1]"], nextSteps: ["Read the cited NASA source."], warnings: ["This is educational context."], questionsToExplore: ["Would you like a simpler explanation?"], confidence: "high", citationIds: ["nasa-source"] }), ["nasa-source"]);
    expect(parsed?.keyPoints).toEqual(["NASA studies vestibular adaptation. [1]"]);
    expect(parsed?.confidence).toBe("high");
  });
  it("keeps educational NASA hazard questions out of urgent routing", () => {
    expect(getUrgentSupport("What has NASA learned about radiation beyond low Earth orbit?")).toBeUndefined();
    expect(getUrgentSupport("How does NASA study breathing changes in spaceflight?")).toBeUndefined();
    expect(getUrgentSupport("I'm having trouble breathing")?.topic).toBe("breathing");
  });
  it("treats general health questions as education, but personal red flags as urgent", () => {
    for (const question of ["What causes headaches?", "How can I improve my sleep quality?", "What are the signs of a heart attack?", "Why does stress raise blood pressure?", "How much water should adults drink?"]) expect(getUrgentSupport(question)).toBeUndefined();
    expect(getUrgentSupport("Why is my chest hurting?")?.topic).toBe("chest");
    expect(getUrgentSupport("How do I stop my friend's bleeding?")?.topic).toBe("bleeding");
    expect(getUrgentSupport("I have chest pain")?.topic).toBe("chest");
  });
  it("recognises everyday health topics", () => {
    for (const question of ["How can I sleep better?", "Is a high-protein diet good for muscles?", "What lowers stress?", "Why do I get headaches?"]) expect(isHealthQuestion(question)).toBe(true);
    expect(isHealthQuestion("How does NASA study distant galaxies?")).toBe(false);
  });
  it("accepts uncited general health answers and rejects citations or links", () => {
    const parsed = parseGeneralHealthAnswer(JSON.stringify({ answer: "Regular sleep and wake times help many people sleep better.", keyPoints: ["Keep a consistent schedule."], nextSteps: ["Limit screens before bed."], warnings: [], questionsToExplore: [], confidence: "high" }));
    expect(parsed?.citationIds).toEqual([]);
    expect(parsed?.warnings[0]).toContain("Talk to a doctor");
    expect(parseGeneralHealthAnswer(JSON.stringify({ answer: "Sleep helps recovery. [1]" }))).toBeUndefined();
    expect(parseGeneralHealthAnswer(JSON.stringify({ answer: "See https://example.com" }))).toBeUndefined();
    expect(parseGeneralHealthAnswer("not json")).toBeUndefined();
  });
  it("creates a neutral NASA query without the personal wording", () => {
    expect(sanitizedNasaQuery("breathing")).toBe("What does NASA documentation report about respiratory concerns during human spaceflight?");
    expect(sanitizedNasaQuery("breathing")).not.toContain("I");
  });
});
