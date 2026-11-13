import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActiveGuidanceView } from "./ActiveGuidanceView";

describe("Active mission guidance", () => {
  it("provides working shortcuts to the mission tools", async () => {
    const onViewChange = vi.fn();
    const user = userEvent.setup();
    render(<ActiveGuidanceView onViewChange={onViewChange} />);
    for (const [label, view] of [
      ["Check Profile", "profile"], ["Open Home", "home"], ["Review Trends", "trends"],
      ["Open Wellbeing", "wellbeing"], ["Explore Movement", "movement"],
      ["Review connections", "profile"],
    ]) {
      await user.click(screen.getByRole("button", { name: label }));
      expect(onViewChange).toHaveBeenLastCalledWith(view);
    }
  });

  it("expands health topics and links directly to NASA references", async () => {
    const user = userEvent.setup();
    render(<ActiveGuidanceView onViewChange={vi.fn()} />);
    const title = screen.getByText("Follow your exercise prescription");
    const topic = title.closest("details")!;
    expect(topic.open).toBe(false);
    await user.click(title);
    expect(topic.open).toBe(true);
    expect(screen.getByRole("link", { name: "NASA: exercise and crew care" })).toHaveAttribute("href", "https://www.nasa.gov/missions/station/faq-the-real-story-about-astronaut-health-care-in-space/");
    for (const link of screen.getAllByRole("link").filter(link => link.getAttribute("href")?.startsWith("#"))) {
      expect(document.querySelector(link.getAttribute("href")!)).not.toBeNull();
    }
  });

  it("keeps the remaining guidance and removes the requested sections", () => {
    render(<ActiveGuidanceView onViewChange={vi.fn()} />);
    expect(screen.queryByRole("heading", { name: "Mission procedures come first" })).not.toBeInTheDocument();
    expect(screen.getByText(/ORBIT cannot contact the medical team/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "About and limits" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Prepare for a medical check-in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Medical check-in" })).not.toBeInTheDocument();
  });
});
