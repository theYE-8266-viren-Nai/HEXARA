import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { WellbeingCheckIn } from "./WellbeingCheckIn";
import { hasSampleHistory } from "../domain/wellbeingHistory";

describe("WellbeingCheckIn journal", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows sample data on only some recent days and never on old days", () => {
    const today = new Date("2026-11-14T12:00:00");
    expect(hasSampleHistory(new Date("2026-11-13T12:00:00"), today)).toBe(true);
    expect(hasSampleHistory(new Date("2026-11-11T12:00:00"), today)).toBe(false);
    expect(hasSampleHistory(new Date("2026-10-23T12:00:00"), today)).toBe(false);
    expect(hasSampleHistory(new Date("2026-11-15T12:00:00"), today)).toBe(false);
  });

  it("restores an existing reflection and allows deleting it", async () => {
    const earlierThisWeek = new Date();
    earlierThisWeek.setDate(earlierThisWeek.getDate() - (earlierThisWeek.getDay() || 6));
    earlierThisWeek.setHours(9, 0, 0, 0);
    window.localStorage.setItem("horizon:journal:future", JSON.stringify([{ id: "existing", createdAt: earlierThisWeek.toISOString(), text: "Earlier reflection." }]));
    const user = userEvent.setup();
    render(<WellbeingCheckIn stage="future" client={null} />);
    const week = screen.getByLabelText("Recent days");
    await user.click(within(week).getAllByRole("button", { name: /history available/i })[0]);
    await user.click(screen.getByRole("button", { name: "Check history for selected day" }));
    expect(screen.getByText("Earlier reflection.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a journal reflection" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete journal entry" }));
    await waitFor(() => expect(window.localStorage.getItem("horizon:journal:future")).toBe("[]"));
  });

  it("opens today's saved check-in as history and allows deleting it", async () => {
    const completedAt = new Date().toISOString();
    window.localStorage.setItem("horizon:checkin-history:retired", JSON.stringify([{ answers: { mood: "steady" }, note: "Saved note", completedAt }]));
    const user = userEvent.setup();

    render(<WellbeingCheckIn stage="retired" client={null} />);

    await user.click(screen.getByRole("button", { name: "Check history for selected day" }));
    expect(screen.getByText("Saved note")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete check-in" }));

    expect(screen.queryByText("Saved note")).not.toBeInTheDocument();
    await waitFor(() => expect(window.localStorage.getItem("horizon:checkin-history:retired")).toBe("[]"));
  });
});
