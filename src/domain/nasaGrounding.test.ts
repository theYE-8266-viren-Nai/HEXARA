import { describe, expect, it } from "vitest";
import { NO_EVIDENCE_TEXT, parseGroundedAnswer, sanitizedNasaQuery } from "../../supabase/functions/_shared/nasaGrounding";
import { getUrgentSupport } from "../../supabase/functions/_shared/emergencySupport";

describe("NASA grounding contract", () => {
  it("accepts only cited answers whose source ids were retrieved", () => {
    expect(parseGroundedAnswer('{"answer":"NASA reports a documented effect. [1]","citationIds":["nasa-source"]}', ["nasa-source"])).toEqual({ answer: "NASA reports a documented effect. [1]", citationIds: ["nasa-source"] });
    expect(parseGroundedAnswer('{"answer":"Unsupported. [1]","citationIds":["invented"]}', ["nasa-source"])).toBeUndefined();
    expect(parseGroundedAnswer('{"answer":"See https://example.com [1]","citationIds":["nasa-source"]}', ["nasa-source"])).toBeUndefined();
  });
  it("allows the exact no-evidence response without citations", () => {
    expect(parseGroundedAnswer(JSON.stringify({ answer: NO_EVIDENCE_TEXT, citationIds: [] }), [])).toEqual({ answer: NO_EVIDENCE_TEXT, citationIds: [] });
  });
  it("keeps educational NASA hazard questions out of urgent routing", () => {
    expect(getUrgentSupport("What has NASA learned about radiation beyond low Earth orbit?")).toBeUndefined();
    expect(getUrgentSupport("How does NASA study breathing changes in spaceflight?")).toBeUndefined();
    expect(getUrgentSupport("I'm having trouble breathing")?.topic).toBe("breathing");
  });
  it("creates a neutral NASA query without the personal wording", () => {
    expect(sanitizedNasaQuery("breathing")).toBe("What does NASA documentation report about respiratory concerns during human spaceflight?");
    expect(sanitizedNasaQuery("breathing")).not.toContain("I");
  });
});
