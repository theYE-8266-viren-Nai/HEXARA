import { describe, expect, it } from "vitest";
import { viewAvailable, type ViewName } from "./AppShell";

describe("which views each stage can open", () => {
  it("offers Movement to all stages", () => {
    expect(viewAvailable("movement", "future")).toBe(true);
    expect(viewAvailable("movement", "active")).toBe(true);
    expect(viewAvailable("movement", "retired")).toBe(true);
  });
  it("leaves every other view available to every stage", () => {
    const others: ViewName[] = ["home", "trends", "wellbeing", "guidance", "profile"];
    for (const view of others) for (const stage of ["future", "active", "retired"] as const) expect(viewAvailable(view, stage), `${view}/${stage}`).toBe(true);
  });
});
