import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

// Keep UI tests offline and deterministic: no live Supabase project, no anonymous sign-in.
vi.mock("./lib/supabase", () => ({ supabase: null, supabaseConfigured: false }));

type StageTitle = "Future traveler" | "Active astronaut" | "Retired astronaut";

/** The app now opens on the required stage-selection screen. */
async function enterStage(user: ReturnType<typeof userEvent.setup>, title: StageTitle = "Active astronaut") {
  await user.click(await screen.findByRole("button", { name: new RegExp(title) }));
  await screen.findByRole("combobox", { name: "Life stage" });
}

describe("Horizon app shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("requires stage selection, renders the safety disclaimer, and switches stage", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Where are you in your journey?" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Life stage" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/selection will not persist until Supabase is available/);
    await enterStage(user);

    expect(screen.getByText("Simulated data. Not medical advice. Not diagnostic.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Life stage" })).toHaveValue("active");

    await user.selectOptions(screen.getByRole("combobox", { name: "Life stage" }), "retired");

    expect(screen.getByRole("combobox", { name: "Life stage" })).toHaveValue("retired");
    expect(screen.getByText(/Retired astronaut/)).toBeInTheDocument();
    expect(screen.getByText("Post-mission workspace")).toBeInTheDocument();
  });

  it("changes the active view from the navigation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.click(screen.getAllByRole("button", { name: /Trends/ })[0]);

    expect(screen.getByRole("heading", { name: "Your signals over time" })).toBeInTheDocument();
  });

  it("explains a recovery concern in plain language", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.click(screen.getByRole("button", { name: "Profile" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "recovery_concern");
    expect(screen.getByText("Loading simulated signals…")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Loading simulated signals…")).not.toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);

    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.getByText(/Sleep was below your usual range on 4 of the last 5 days/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Take the optional wellbeing check-in/ })).toBeInTheDocument();
  });

  it("shows a separate stale-data explanation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.click(screen.getByRole("button", { name: "Profile" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "stale");
    await waitFor(() => expect(screen.queryByText("Loading simulated signals…")).not.toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);

    expect(screen.getByText(/These readings are stale/)).toBeInTheDocument();
    expect(screen.getByText(/charts remain visible for context/)).toBeInTheDocument();
  });

  it("shows a clear unavailable state when the simulated source disconnects", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.click(screen.getByRole("button", { name: "Profile" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "sensor_disconnected");
    await waitFor(() => expect(screen.queryByText("Loading simulated signals…")).not.toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);

    expect(screen.getByText("Data unavailable")).toBeInTheDocument();
    expect(screen.getByText(/simulated sensor has stopped sending readings/)).toBeInTheDocument();
  });

  it("keeps Trends unavailable in offline mode with a recovery path", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.click(screen.getByRole("button", { name: "Profile" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "offline");
    await waitFor(() => expect(screen.queryByText("Loading simulated signals…")).not.toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);

    expect(screen.getByRole("heading", { name: "Trends are unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/Reconnect it from Profile/)).toBeInTheDocument();
  });

  it("opens the plain-language reason for a trend alert", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.click(screen.getByRole("button", { name: "Profile" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "recovery_concern");
    await waitFor(() => expect(screen.queryByText("Loading simulated signals…")).not.toBeInTheDocument());
    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);
    await user.click(screen.getByRole("button", { name: "Show alert reason" }));

    expect(screen.getByText(/Sleep was below your usual range on 4 of the last 5 days/)).toBeInTheDocument();
  });

  it("persists the simulation seed and replays events locally", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.click(screen.getByRole("button", { name: "Profile" }));
    const seed = screen.getByRole("spinbutton", { name: "Simulation seed" });
    await user.clear(seed);
    await user.type(seed, "31415");
    await user.click(screen.getByRole("button", { name: "Replay events" }));

    expect(window.localStorage.getItem("horizon:seed")).toBe("31415");
    expect(screen.getByText("Replay 1 · mock run")).toBeInTheDocument();
  });

  it("saves a wellbeing check-in to local storage", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Mood" }), "4");
    await user.selectOptions(screen.getByRole("combobox", { name: "Stress" }), "2");
    await user.type(screen.getByRole("textbox", { name: "Optional note" }), "Felt steady after exercise.");
    await user.click(screen.getByRole("button", { name: "Save check-in locally" }));

    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
    expect(window.localStorage.getItem("horizon:wellbeing")).toContain("Felt steady after exercise.");
  });

  it("verifies the active astronaut flow from alert to local check-in", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    expect(screen.getByRole("heading", { name: "How are you doing today?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Profile" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "recovery_concern");
    await waitFor(() => expect(screen.queryByText("Loading simulated signals…")).not.toBeInTheDocument());

    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
    expect(screen.getByText("Watch")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);
    await user.click(screen.getByRole("button", { name: "Show alert reason" }));
    expect(screen.getByText(/Sleep was below your usual range on 4 of the last 5 days/)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Mood" }), "4");
    await user.selectOptions(screen.getByRole("combobox", { name: "Stress" }), "2");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sleep quality" }), "Mixed");
    await user.click(screen.getByRole("button", { name: "Save check-in locally" }));
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
  });

  it("opens local support options without sending a message", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    await user.click(screen.getByRole("button", { name: "Open support options" }));

    expect(screen.getByRole("region", { name: "Support options" })).toBeInTheDocument();
    expect(screen.getByText("Crew medic")).toBeInTheDocument();
    expect(screen.getByText(/This demo does not send messages/)).toBeInTheDocument();
  });

  it("persists wellbeing privacy choices locally", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    const notesToggle = screen.getByRole("checkbox", { name: "Free-text notes" });
    expect(notesToggle).not.toBeChecked();
    await user.click(notesToggle);

    expect(JSON.parse(window.localStorage.getItem("horizon:privacy") ?? "{}")).toMatchObject({ notes: true });
  });

  it("shows future preparation without certifying readiness or claiming a failed cloud save", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user, "Future traveler");

    expect(screen.getByRole("combobox", { name: "Life stage" })).toHaveValue("future");
    await user.click(screen.getAllByRole("button", { name: "Guidance" })[0]);
    expect(screen.getByText(/never flight clearance or certification/)).toBeInTheDocument();
    expect(screen.getByText(/does not mean you are ready to fly, medically cleared/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save baseline check-in" }));

    expect(screen.queryByText("Saved to your Supabase workspace.")).not.toBeInTheDocument();
  });

  it("opens the movement check from navigation in synthetic-safe form", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user, "Future traveler");

    await user.click(screen.getAllByRole("button", { name: "Movement" })[0]);
    expect(screen.getByRole("heading", { name: "Practise before you fly" })).toBeInTheDocument();
    expect(screen.getByText(/Camera observations are experimental context only/)).toBeInTheDocument();
  });

  it("persists retired summary field choices locally", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterStage(user);

    await user.selectOptions(screen.getByRole("combobox", { name: "Life stage" }), "retired");
    await user.click(screen.getAllByRole("button", { name: "Guidance" })[0]);
    await user.click(screen.getByRole("checkbox", { name: "Private reflection" }));

    expect(JSON.parse(window.localStorage.getItem("horizon:retired-summary-fields") ?? "{}")).toMatchObject({ reflection: true });
  });

  it("restores local check-in state after a refresh and asks for the stage again without cloud", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await enterStage(user, "Retired astronaut");
    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Mood" }), "5");
    await user.click(screen.getByRole("button", { name: "Save check-in locally" }));
    first.unmount();

    render(<App />);
    // Stage is stored in the anonymous Supabase session, so offline it must be chosen again.
    expect(await screen.findByRole("heading", { name: "Where are you in your journey?" })).toBeInTheDocument();
    await enterStage(user, "Retired astronaut");
    expect(screen.getByRole("combobox", { name: "Life stage" })).toHaveValue("retired");
    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    expect(screen.getByRole("combobox", { name: "Mood" })).toHaveValue("5");
  });
});
