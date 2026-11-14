import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { WellbeingCheckIn } from "./WellbeingCheckIn";

describe("WellbeingCheckIn journal", () => {
  beforeEach(() => window.localStorage.clear());

  it.each(["future", "active", "retired"] as const)("keeps sample history but hides its label and headline for the %s stage", async (stage) => {
    render(<WellbeingCheckIn stage={stage} client={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Previous week" }));
    const sampleDay = screen.getAllByRole("button", { name: /history available/i })[0];
    await userEvent.click(sampleDay);
    await userEvent.click(screen.getByRole("button", { name: "Check history for selected day" }));
    expect(screen.queryByText("Sample history · simulated demo data")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Today looks hard|Mostly steady|doing well today/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("definition").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Delete check-in" })).not.toBeInTheDocument();
  });

  it("restores an existing reflection and allows deleting it", async () => {
    const earlierThisWeek = new Date();
    earlierThisWeek.setDate(earlierThisWeek.getDate() - 1);
    earlierThisWeek.setHours(9, 0, 0, 0);
    window.localStorage.setItem("horizon:journal:future", JSON.stringify([{ id: "existing", createdAt: earlierThisWeek.toISOString(), text: "Earlier reflection." }]));
    const user = userEvent.setup();
    render(<WellbeingCheckIn stage="future" client={null} />);
    if (new Date().getDay() === 0) await user.click(screen.getByRole("button", { name: "Previous week" }));
    const week = screen.getByLabelText("Recent days");
    await user.click(within(week).getByRole("button", { name: new RegExp(earlierThisWeek.toLocaleDateString(undefined, { dateStyle: "full" })) }));
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
