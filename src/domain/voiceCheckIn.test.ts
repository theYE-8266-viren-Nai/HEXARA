import { describe, expect, it } from "vitest";
import { MAX_NOTE_CHARS, VOICE_QUESTIONS, applyUserUtterance, currentPrompt, detectUrgent, firstMessage, parseSpokenRating, questionsFor, startFlow, toFormValues } from "./voiceCheckIn";
import { isNonDiagnostic } from "./visualCheck";

describe("parseSpokenRating", () => {
  it("understands digits and number words", () => {
    expect(parseSpokenRating("4")).toBe(4);
    expect(parseSpokenRating("I'd say 2.")).toBe(2);
    expect(parseSpokenRating("three")).toBe(3);
    expect(parseSpokenRating("Five!")).toBe(5);
    expect(parseSpokenRating("it is a four today")).toBe(4);
  });
  it("understands the scale being spoken", () => {
    expect(parseSpokenRating("three out of five")).toBe(3);
    expect(parseSpokenRating("4 out of 5")).toBe(4);
    expect(parseSpokenRating("2/5")).toBe(2);
  });
  it("understands unambiguous level words", () => {
    expect(parseSpokenRating("very low")).toBe(1);
    expect(parseSpokenRating("pretty low")).toBe(2);
    expect(parseSpokenRating("moderate")).toBe(3);
    expect(parseSpokenRating("okay")).toBe(3);
    expect(parseSpokenRating("quite high")).toBe(4);
    expect(parseSpokenRating("extremely high")).toBe(5);
  });
  it("returns null instead of guessing when an answer is unclear", () => {
    for (const text of ["", "   ", "um", "I don't know", "between 3 and 4", "three or four", "0", "7", "10", "ten", "10 out of 10", "high and low", "not high", "maybe", "1 2 3"]) {
      expect(parseSpokenRating(text), text).toBeNull();
    }
  });
});

describe("detectUrgent", () => {
  it("flags pain and severe symptoms, including crisis wording", () => {
    for (const text of ["I have chest pain", "there is some pain in my arm", "I feel faint", "I almost passed out", "it is getting worse", "severe headache", "I can't breathe properly", "shortness of breath", "I want to hurt myself", "this is an emergency", "bleeding"]) {
      expect(detectUrgent(text), text).toBe(true);
    }
  });
  it("does not flag ordinary check-in answers", () => {
    for (const text of ["three", "I slept well", "a bit tired but fine", "stress is high", "my mood is low today", "no thanks"]) {
      expect(detectUrgent(text), text).toBe(false);
    }
  });
  it("is deliberately conservative: a mention counts even when negated", () => {
    expect(detectUrgent("no pain")).toBe(true);
  });
});

describe("voice flow", () => {
  it("asks the four questions in order, then the optional note", () => {
    let state = startFlow();
    expect(currentPrompt(state)).toBe(VOICE_QUESTIONS[0].ask);
    state = applyUserUtterance(state, "four");
    state = applyUserUtterance(state, "two");
    state = applyUserUtterance(state, "three out of five");
    expect(currentPrompt(state)).toBe(VOICE_QUESTIONS[3].ask);
    state = applyUserUtterance(state, "high");
    expect(state.step).toBe(4);
    expect(state.done).toBe(false);
    state = applyUserUtterance(state, "a little tired after the exercise block");
    expect(state).toMatchObject({ done: true, urgent: false, note: "a little tired after the exercise block", answers: { mood: 4, stress: 2, sleepQuality: 3, energy: 4 } });
    expect(currentPrompt(state)).toBeNull();
  });

  it("re-asks the same question when an answer cannot be understood", () => {
    let state = startFlow();
    state = applyUserUtterance(state, "hmm hard to say");
    expect(state.step).toBe(0);
    state = applyUserUtterance(state, "between three and four");
    expect(state.step).toBe(0);
    state = applyUserUtterance(state, "3");
    expect(state.step).toBe(1);
  });

  it("treats a declined note as no note, and caps a long note", () => {
    const rated = ["3", "3", "3", "3"].reduce((s, t) => applyUserUtterance(s, t), startFlow());
    expect(applyUserUtterance(rated, "No thanks").note).toBe("");
    expect(applyUserUtterance(rated, "x".repeat(1000)).note).toHaveLength(MAX_NOTE_CHARS);
  });

  it("an urgent word ends the flow at any step, keeping only what was answered before", () => {
    let state = applyUserUtterance(startFlow(), "four");
    state = applyUserUtterance(state, "actually I have chest pain");
    expect(state).toMatchObject({ urgent: true, done: true, answers: { mood: 4 } });
    expect(applyUserUtterance(state, "five")).toBe(state); // nothing more is recorded
    const inNote = ["3", "3", "3", "3"].reduce((s, t) => applyUserUtterance(s, t), startFlow());
    expect(applyUserUtterance(inNote, "my arm has severe pain")).toMatchObject({ urgent: true, done: true, note: "" });
  });

  it("converts answers to the form's string values and omits unanswered fields", () => {
    expect(toFormValues({ mood: 4, energy: 2 })).toEqual({ mood: "4", energy: "2" });
    expect(toFormValues({})).toEqual({});
  });

  it("scripted questions never use diagnostic or clinical wording", () => {
    for (const q of VOICE_QUESTIONS) expect(isNonDiagnostic(q.ask), q.ask).toBe(true);
  });

  it("asks only the questions a stage's form shows, in the standard order, and the note comes right after", () => {
    expect(questionsFor(["sleepQuality", "mood", "stress"]).map((q) => q.field)).toEqual(["mood", "stress", "sleepQuality"]);
    let state = startFlow(["mood", "stress", "sleepQuality"]);
    expect(state.fields).toEqual(["mood", "stress", "sleepQuality"]);
    for (const text of ["four", "two", "three"]) state = applyUserUtterance(state, text);
    expect(state.done).toBe(false);
    expect(currentPrompt(state)).toMatch(/anything else/);
    state = applyUserUtterance(state, "high"); // the note step: this is a note, NOT an energy answer
    expect(state).toMatchObject({ done: true, note: "high", answers: { mood: 4, stress: 2, sleepQuality: 3 } });
    expect(state.answers.energy).toBeUndefined();
  });

  it("says the right number of questions in the first message", () => {
    expect(firstMessage(3)).toMatch(/three short questions/);
    expect(firstMessage(4)).toMatch(/four short questions/);
    expect(firstMessage(1)).toMatch(/one short question\./);
    expect(isNonDiagnostic(firstMessage(3))).toBe(true);
  });
});
