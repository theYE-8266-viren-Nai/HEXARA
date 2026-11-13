import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { deviceTiming } from "./lib/useDeviceStream";
import { bluetoothTiming } from "./lib/useBluetoothHeartRate";
import { bluetoothAccess } from "./lib/adapters/webBluetoothHeartRate";
import { createFakeBluetooth, hrBytes } from "./test/fakeBluetooth";
import { webhookTiming } from "./lib/useWebhookSource";
import { demoVoiceTiming } from "./lib/voice/mockVoiceEngine";
import { createFakeReceiver } from "./test/fakeReceiverFetch";

// Keep UI tests offline and deterministic even when a local .env.local configures Supabase.
vi.mock("./lib/supabase", () => ({ supabase: null, supabaseConfigured: false }));

async function waitForSignals() {
  await waitFor(() => {
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading simulated signals…")).not.toBeInTheDocument();
  });
}

async function openWorkspace(stage: "active" | "future" | "retired" = "active") {
  const view = render(<App />);
  const labels = { active: "Active astronaut", future: "Future traveler", retired: "Retired astronaut" };
  await userEvent.click(await screen.findByRole("button", { name: labels[stage] }));
  await screen.findByRole("combobox", { name: "Life stage" });
  return view;
}

describe("Horizon app shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("switches appearance on the landing page and keeps it across workspace navigation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem("horizon:theme")).toBe('"light"');
    await user.click(await screen.findByRole("button", { name: "Active astronaut" }));
    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("heading", { name: "Your signals over time" })).toBeInTheDocument();
  });

  it("restores the saved appearance after a refresh", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.click(screen.getByRole("button", { name: "Switch to light mode" }));
    first.unmount();
    const second = render(<App />);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    second.unmount();
    render(<App />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("uses the device appearance until the user saves a choice", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    try {
      const first = render(<App />);
      expect(document.documentElement).toHaveAttribute("data-theme", "light");
      await userEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
      first.unmount();
      render(<App />);
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    } finally { vi.unstubAllGlobals(); }
  });


  it("requires a stage choice and keeps all three paths accessible", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Choose your mission stage" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Future traveler" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active astronaut" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retired astronaut" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Life stage" })).not.toBeInTheDocument();
    expect(screen.getByText("Simulated data. Not medical advice. Not diagnostic.")).toBeInTheDocument();
  });

  it.each([
    ["future", "Build your starting pattern"],
    ["retired", "Keep the long view"],
  ] as const)("enters the %s workspace from its stage card", async (stage, heading) => {
    await openWorkspace(stage);
    expect(screen.getByRole("combobox", { name: "Life stage" })).toHaveValue(stage);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("shows wearable-supported activity cards on the retired Home view", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("horizon:scenario", JSON.stringify("recovery_concern"));
    await openWorkspace("retired");

    expect(await screen.findByRole("heading", { name: "Wearable activity, at a glance" })).toBeInTheDocument();
    expect(screen.getByText("Sleep duration")).toBeInTheDocument();
    expect(screen.getByText("Mobility")).toBeInTheDocument();
    expect(screen.getByText("Walking steadiness · Updated today")).toBeInTheDocument();
    expect(screen.getByText("Estimated stress level")).toBeInTheDocument();
    expect(screen.getByText("Moderate")).toBeInTheDocument();
    expect(screen.getByText("HRV and resting heart rate · Wellness only")).toBeInTheDocument();
    expect(screen.getByText("Exercise minutes")).toBeInTheDocument();
    expect(screen.getByText("Connected measurements")).toBeInTheDocument();
    expect(screen.queryByText("Wrist-temperature trend")).not.toBeInTheDocument();
    expect(screen.queryByText("Radiation context")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);
    expect(screen.getByRole("heading", { name: "Your wearable trends over time" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Radiation dose" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Core temperature" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mobility" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mobility trend chart" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Exercise minutes" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Exercise minutes trend chart" })).toBeInTheDocument();
  });

  it("renders the safety disclaimer and switches the life stage", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    expect(screen.getByText("Simulated data. Not medical advice. Not diagnostic.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Life stage" })).toHaveValue("active");

    await user.selectOptions(screen.getByRole("combobox", { name: "Life stage" }), "retired");

    expect(screen.getByRole("combobox", { name: "Life stage" })).toHaveValue("retired");
    expect(screen.getByText(/Retired astronaut/)).toBeInTheDocument();
    expect(screen.getByText("Post-mission workspace")).toBeInTheDocument();
  });

  it("changes the active view from the navigation", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: /Trends/ })[0]);

    expect(screen.getByRole("heading", { name: "Your signals over time" })).toBeInTheDocument();
  });

  it("explains a recovery concern in plain language", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "recovery_concern");
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);

    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.getByText(/Sleep was below your usual range on 4 of the last 5 days/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Take the optional wellbeing check-in/ })).toBeInTheDocument();
  });

  it("shows a separate stale-data explanation", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "stale");
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);

    expect(screen.getByText(/These readings are stale/)).toBeInTheDocument();
    expect(screen.getByText(/charts remain visible for context/)).toBeInTheDocument();
  });

  it("shows a clear unavailable state when the simulated source disconnects", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "sensor_disconnected");
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);

    expect(screen.getByText("Data unavailable")).toBeInTheDocument();
    expect(screen.getByText(/simulated sensor has stopped sending readings/)).toBeInTheDocument();
  });

  it("keeps Trends unavailable in offline mode with a recovery path", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "offline");
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);

    expect(screen.getByRole("heading", { name: "Trends are unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/Reconnect it from Profile/)).toBeInTheDocument();
  });

  it("opens the plain-language reason for a trend alert", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "recovery_concern");
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);
    await user.click(screen.getByRole("button", { name: "Show alert reason" }));

    expect(screen.getByText(/Sleep was below your usual range on 4 of the last 5 days/)).toBeInTheDocument();
  });

  it("persists the simulation seed and replays events locally", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    const seed = screen.getByRole("spinbutton", { name: "Simulation seed" });
    await user.clear(seed);
    await user.type(seed, "31415");
    await user.click(screen.getByRole("button", { name: "Replay events" }));

    expect(window.localStorage.getItem("horizon:seed")).toBe("31415");
    expect(screen.getByText("Replay 1 · mock run")).toBeInTheDocument();
  });

  it("saves a wellbeing check-in to local storage", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    fireEvent.change(screen.getByRole("slider", { name: "Mood" }), { target: { value: "4" } });
    fireEvent.change(screen.getByRole("slider", { name: "Stress" }), { target: { value: "2" } });
    await user.type(screen.getByRole("textbox", { name: "Optional note" }), "Felt steady after exercise.");
    await user.click(screen.getByRole("button", { name: "Save check-in locally" }));

    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
    expect(window.localStorage.getItem("horizon:wellbeing")).toContain("Felt steady after exercise.");
  });

  it("verifies the active astronaut flow from alert to local check-in", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    expect(screen.getByRole("heading", { name: "How are you doing today?" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "recovery_concern");
    await waitForSignals();

    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
    expect(screen.getByText("Watch")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);
    await user.click(screen.getByRole("button", { name: "Show alert reason" }));
    expect(screen.getByText(/Sleep was below your usual range on 4 of the last 5 days/)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    fireEvent.change(screen.getByRole("slider", { name: "Mood" }), { target: { value: "4" } });
    fireEvent.change(screen.getByRole("slider", { name: "Stress" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("slider", { name: "Sleep quality" }), { target: { value: "3" } });
    await user.click(screen.getByRole("button", { name: "Save check-in locally" }));
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
  });

  it("opens local support options without sending a message", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    await user.click(screen.getByRole("button", { name: "Open support options" }));

    expect(screen.getByRole("region", { name: "Support options" })).toBeInTheDocument();
    expect(screen.getByText("Former astronaut peer")).toBeInTheDocument();
    expect(screen.getByText("Behavioral-health professional")).toBeInTheDocument();
    expect(screen.getByText("Family or trusted person")).toBeInTheDocument();
    expect(screen.getByText("Urgent support")).toBeInTheDocument();
    expect(screen.getByText(/This demo helps you review your choices but does not contact anyone/)).toBeInTheDocument();
  });

  it("persists wellbeing privacy choices locally", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    const notesToggle = screen.getByRole("checkbox", { name: "Free-text notes" });
    expect(notesToggle).not.toBeChecked();
    await user.click(notesToggle);

    expect(JSON.parse(window.localStorage.getItem("horizon:privacy") ?? "{}")).toMatchObject({ notes: true });
  });

  it("adds retired wellbeing context without removing support or privacy choices", async () => {
    const user = userEvent.setup();
    await openWorkspace("retired");

    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    expect(screen.getByRole("heading", { name: "A private moment to check in" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Mood" })).toHaveValue("3");
    expect(screen.getByRole("slider", { name: "Stress" })).toHaveValue("3");
    expect(screen.getByRole("slider", { name: "Sleep quality" })).toHaveValue("3");
    expect(screen.getByRole("slider", { name: "Energy" })).toHaveValue("3");
    expect(screen.getByRole("combobox", { name: "Sense of purpose" })).toHaveValue("3");
    expect(screen.getByRole("combobox", { name: "Social connection" })).toHaveValue("3");

    await user.click(screen.getByRole("button", { name: "Family adjustment" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Sense of purpose" }), "4");
    await user.selectOptions(screen.getByRole("combobox", { name: "Social connection" }), "4");
    expect(JSON.parse(window.localStorage.getItem("horizon:wellbeing") ?? "{}")).toMatchObject({ purpose: "4", socialConnection: "4", transitionTags: ["Family adjustment"] });

    expect(screen.getByRole("heading", { name: "Talk to a person" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Privacy choices" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Free-text notes" })).toBeInTheDocument();
  });

  it("opens future preparation practices and the adaptation timeline without certifying readiness", async () => {
    const user = userEvent.setup();
    await openWorkspace("future");

    expect(screen.getByRole("combobox", { name: "Life stage" })).toHaveValue("future");
    await user.click(screen.getAllByRole("button", { name: "Guidance" })[0]);
    expect(screen.getByText(/never flight clearance or certification/)).toBeInTheDocument();
    const practice = screen.getByRole("button", { name: /Equipment-free mobility/ });
    await user.click(practice);
    expect(practice).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /D2.*Motion sensitivity/ }));
    expect(screen.getByRole("heading", { name: "Motion sensitivity" })).toBeInTheDocument();
  });

  it("persists retired summary field choices locally", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.selectOptions(screen.getByRole("combobox", { name: "Life stage" }), "retired");
    await user.click(screen.getAllByRole("button", { name: "Guidance" })[0]);
    expect(screen.getByRole("heading", { name: "Your long-term follow-up" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maintain physical and mental wellbeing" })).toBeInTheDocument();
    await user.click(screen.getByText("Physical health"));
    expect(screen.getByText("Movement & strength")).toBeInTheDocument();
    expect(screen.getByText("Bone & balance")).toBeInTheDocument();
    expect(screen.getByText("Heart & circulation")).toBeInTheDocument();
    expect(screen.getByText("Sleep & recovery")).toBeInTheDocument();
    expect(screen.getByText("Nutrition & preventive care")).toBeInTheDocument();
    await user.click(screen.getByText("Movement & strength"));
    expect(screen.getByRole("link", { name: /NASA strength, conditioning and rehabilitation/ })).toHaveAttribute("href", expect.stringContaining("nasa.gov"));
    await user.click(screen.getByText("Mental health"));
    expect(screen.getByText("Emotional wellbeing")).toBeInTheDocument();
    expect(screen.getByText("Social connection")).toBeInTheDocument();
    expect(screen.getByText("Purpose & daily routine")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Long-term follow-up preview" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Life after flying reflection" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Private reflection" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Wellbeing check-ins" }));
    await user.click(screen.getByRole("button", { name: "Preview summary" }));

    expect(JSON.parse(window.localStorage.getItem("horizon:retired-summary-fields") ?? "{}")).toMatchObject({ wellbeing: true });
    expect(screen.getByRole("region", { name: "Appointment summary preview" })).toHaveTextContent("Locally saved wellbeing check-ins");
  });

  it("imports a synthetic DXA report and creates a local sample reminder", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.selectOptions(screen.getByRole("combobox", { name: "Life stage" }), "retired");
    await user.click(screen.getAllByRole("button", { name: "Guidance" })[0]);
    await user.click(screen.getByText("Bone-density trend over years"));
    await user.click(screen.getByRole("button", { name: "Import sample DXA report" }));

    expect(screen.getByText("Synthetic sample · not a real medical record")).toBeInTheDocument();
    expect(screen.getByText("Horizon displays the supplied note; it does not calculate a diagnosis.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Bone health follow-up due · May 12, 2027/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create sample appointment" }));
    await user.click(screen.getByRole("checkbox", { name: "Create local reminder" }));

    expect(screen.getByRole("heading", { name: /Bone health appointment · May 18, 2027/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No external calendar or clinic was contacted");
    expect(JSON.parse(window.localStorage.getItem("horizon:retired-sample-dxa") ?? "null")).toMatchObject({ id: "sample-dxa-2026-05" });
    expect(JSON.parse(window.localStorage.getItem("horizon:retired-sample-appointment") ?? "null")).toMatchObject({ reminder: true });
  });

  it("imports sample vision guidance and routes heart and wellbeing actions", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.selectOptions(screen.getByRole("combobox", { name: "Life stage" }), "retired");
    await user.click(screen.getAllByRole("button", { name: "Guidance" })[0]);
    expect(screen.getByRole("heading", { name: "No sample follow-up scheduled" })).toBeInTheDocument();

    await user.click(screen.getByText("Vision and cardiovascular trend"));
    await user.click(screen.getByRole("button", { name: "Import sample eye-exam record" }));
    expect(screen.getByText("Synthetic sample · not a real eye exam")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Vision follow-up · December 15, 2026/ })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("horizon:retired-sample-vision") ?? "null")).toMatchObject({ id: "sample-vision-2026-08" });

    await user.click(screen.getByRole("button", { name: "Review wearable trends" }));
    expect(screen.getByRole("heading", { name: "Your wearable trends over time" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Guidance" })[0]);
    await user.click(screen.getByText("Sleep and mood context"));
    await user.click(screen.getByRole("button", { name: "Complete wellbeing check-in" }));
    expect(screen.getByRole("heading", { name: "A private moment to check in" })).toBeInTheDocument();
  });

  it("restores local check-in state after reselecting a workspace on refresh", async () => {
    const user = userEvent.setup();
    const first = await openWorkspace();
    await user.selectOptions(screen.getByRole("combobox", { name: "Life stage" }), "retired");
    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    fireEvent.change(screen.getByRole("slider", { name: "Mood" }), { target: { value: "5" } });
    await user.click(screen.getByRole("button", { name: "Save check-in locally" }));
    first.unmount();

    await openWorkspace("retired");
    expect(screen.getByRole("combobox", { name: "Life stage" })).toHaveValue("retired");
    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    expect(screen.getByRole("slider", { name: "Mood" })).toHaveValue("5");
  });

  it("opens the Movement check with its camera disclaimer and privacy limits", async () => {
    const user = userEvent.setup();
    await openWorkspace("future");

    await user.click(screen.getAllByRole("button", { name: "Movement" })[0]);
    expect(screen.getByRole("heading", { name: "Practise before you fly" })).toBeInTheDocument();
    expect(screen.getByText(/Camera observations are experimental context only/)).toBeInTheDocument();
    expect(screen.getByText(/never recorded or uploaded/)).toBeInTheDocument();
  });

  it("shows the staged wearable loader, then live readings with a freshness badge", async () => {
    deviceTiming.connectMs = 400;
    try {
      await openWorkspace("active");
      expect(await screen.findByRole("progressbar", { name: "Wearable connection progress" })).toBeInTheDocument();
      expect(screen.getByText("Searching for your wearable…")).toBeInTheDocument();
      expect(await screen.findByText("Pairing securely…")).toBeInTheDocument();
      expect(await screen.findByText("Syncing recent readings…")).toBeInTheDocument();
      expect(await screen.findByText("Live · synced just now")).toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.getAllByLabelText("Live").length).toBeGreaterThan(0);
      expect(screen.getByText("Resting heart rate")).toBeInTheDocument();
    } finally { deviceTiming.connectMs = 30; }
  });

  it("starts Future with no device paired, then pairs and fills the baseline from the wearable", async () => {
    const user = userEvent.setup();
    await openWorkspace("future");

    expect(await screen.findByRole("heading", { name: "No device paired" })).toBeInTheDocument();
    expect(screen.queryByText("Resting heart rate")).not.toBeInTheDocument();
    expect(screen.queryByText(/Mission day/)).not.toBeInTheDocument();
    expect(screen.getByText(/Pre-mission/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pair simulated wearable" }));
    expect(await screen.findByText("Live · synced just now")).toBeInTheDocument();
    expect(screen.getByText("Resting heart rate")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Guidance" })[0]);
    await user.click(screen.getByRole("button", { name: "Fill from my wearable" }));
    expect(Number((screen.getByLabelText("Resting heart rate") as HTMLInputElement).value)).toBeGreaterThan(30);
    expect(window.localStorage.getItem("horizon:device-paired")).toBe("true");
  });

  it("lets the user disconnect and reconnect the wearable from Profile", async () => {
    const user = userEvent.setup();
    await openWorkspace("active");
    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.click(await screen.findByRole("button", { name: "Disconnect wearable" }));
    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
    expect(screen.getByRole("heading", { name: "Device disconnected" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reconnect wearable" }));
    expect(await screen.findByText("Live · synced just now")).toBeInTheDocument();
  });

  it("reports a lost signal without inventing readings", async () => {
    const user = userEvent.setup();
    await openWorkspace("active");
    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "sensor_disconnected");
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
    expect(await screen.findByText("Signal lost · wearable not responding")).toBeInTheDocument();
    expect(screen.queryByLabelText("Live")).not.toBeInTheDocument();
  });

  it("shows where Home data came from and its quality, and offers file import", async () => {
    const user = userEvent.setup();
    await openWorkspace();
    await waitForSignals();

    const strip = await screen.findByRole("region", { name: "Data source and quality" });
    expect(strip).toHaveTextContent("Source: Simulated wearable");
    expect(strip).toHaveTextContent(/Data quality: (good|limited)/);
    await user.click(within(strip).getByRole("button", { name: "Import a file instead" }));
    expect(screen.getByRole("heading", { name: "Import device data" })).toBeInTheDocument();
  });

  it("shows source, last sync and quality on Trends too", async () => {
    const user = userEvent.setup();
    await openWorkspace();
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);

    const strip = await screen.findByRole("region", { name: "Data source and quality" });
    expect(strip).toHaveTextContent("Source: Simulated wearable");
    expect(strip).toHaveTextContent(/Last sync: \d{1,2}:\d{2}/);
    expect(strip).toHaveTextContent(/Data quality: (good|limited)/);
    expect(strip).toHaveTextContent(/Alerts from: (completed days of device readings|demo scenario)/);
  });

  it("explains that Bluetooth is unavailable and keeps the simulated wearable", async () => {
    const user = userEvent.setup();
    await openWorkspace();
    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);

    const card = await screen.findByLabelText("Bluetooth heart-rate device", { selector: "div" });
    expect(card).toHaveTextContent("Not supported in this browser");
    expect(card).toHaveTextContent(/Chrome and Edge/);
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("connects a Bluetooth heart-rate device and shows its cleaned data as the heart-rate source", async () => {
    const user = userEvent.setup();
    const fake = createFakeBluetooth({ name: "Test Strap" });
    const savedGet = bluetoothAccess.get; const savedNow = deviceTiming.now; const savedRefresh = bluetoothTiming.refreshMs;
    let clock = Date.now();
    bluetoothAccess.get = () => fake.bluetooth; deviceTiming.now = () => clock; bluetoothTiming.refreshMs = 20;
    try {
      await openWorkspace();
      await waitForSignals();
      await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
      await user.click(await screen.findByRole("button", { name: "Connect Bluetooth heart-rate device" }));

      const card = await screen.findByLabelText("Bluetooth heart-rate device", { selector: "div" });
      await waitFor(() => expect(card).toHaveTextContent("Connected · Test Strap"));
      for (const bpm of [71, 72, 73, 72, 71, 72, 73, 74]) { clock += 1000; fake.emit(hrBytes(bpm)); }
      await waitFor(() => expect(card).toHaveTextContent("Live · Test Strap"));
      expect(card).toHaveTextContent("Receiving clean readings");
      expect(card).not.toHaveTextContent("Collecting readings");

      await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
      const strip = await screen.findByRole("region", { name: "Data source and quality" });
      expect(strip).toHaveTextContent("Bluetooth heart-rate device");
      expect(strip).toHaveTextContent("other signals simulated");
      expect(strip).toHaveTextContent("Bluetooth readings are display-only until a full day is collected");

      await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);
      expect(await screen.findByText("Live from your Bluetooth heart-rate device.")).toBeInTheDocument();

      await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
      await user.click(await screen.findByRole("button", { name: "Disconnect device" }));
      expect(await screen.findByRole("button", { name: "Connect Bluetooth heart-rate device" })).toBeInTheDocument();
      expect(fake.state.serverDisconnected).toBe(true);
    } finally {
      bluetoothAccess.get = savedGet; deviceTiming.now = savedNow; bluetoothTiming.refreshMs = savedRefresh;
    }
  });

  it("states the assumed devices and signals on Profile", async () => {
    const user = userEvent.setup();
    await openWorkspace();
    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);

    const panel = await screen.findByRole("region", { name: "Assumed data sources" });
    expect(panel).toHaveTextContent("does not measure anything");
    expect(panel).toHaveTextContent("Personal dosimeter");
    expect(panel).toHaveTextContent("Skin temperature, not core body temperature");
    expect(within(panel).getAllByRole("listitem").length).toBeGreaterThanOrEqual(6);
    expect(within(panel).getByRole("heading", { name: "Not assumed" })).toBeInTheDocument();
    expect(panel.textContent).not.toMatch(/blood pressure detected|diagnosed|medical condition/i);
  });

  it("labels temperature as skin temperature and notes the assumed devices on Home", async () => {
    await openWorkspace();
    await waitForSignals();

    expect(await screen.findByText("Skin temperature")).toBeInTheDocument();
    expect(screen.queryByText("Core temperature")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Data source and quality" })).toHaveTextContent("Signals assume a crew wearable and a personal dosimeter");
  });

  it("shows the Future baseline progress without a cloud session", async () => {
    const user = userEvent.setup();
    await openWorkspace("future");
    await user.click(screen.getAllByRole("button", { name: "Guidance" })[0]);

    expect(await screen.findByRole("heading", { name: "Your baseline so far" })).toBeInTheDocument();
    expect(await screen.findByText(/0 of 3 check-ins/)).toBeInTheDocument();
    expect(screen.getByText(/Cloud save (is )?unavailable/)).toBeInTheDocument();
  });

  it("explains that the webhook receiver is unavailable outside the dev server", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("not json"); } }));
    try {
      await openWorkspace();
      await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
      const card = await screen.findByLabelText("Webhook source (local demo)", { selector: "div" });
      await waitFor(() => expect(card).toHaveTextContent("Not available in this build"));
      expect(card).toHaveTextContent(/only runs on the development server/);
      expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    } finally { vi.unstubAllGlobals(); }
  });

  it("receives a service's readings, cleans them, and shows them as the source for those signals only", async () => {
    const user = userEvent.setup();
    const fake = createFakeReceiver(() => Date.now());
    vi.stubGlobal("fetch", fake.fetchImpl);
    const savedPoll = webhookTiming.pollMs; webhookTiming.pollMs = 30;
    try {
      await openWorkspace();
      await waitForSignals();
      await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
      const card = await screen.findByLabelText("Webhook source (local demo)", { selector: "div" });
      await waitFor(() => expect(within(card).getByRole("button", { name: "Start receiving" })).toBeInTheDocument());
      await user.click(within(card).getByRole("button", { name: "Start receiving" }));
      await waitFor(() => expect(card).toHaveTextContent("Listening"));
      expect(within(card).getByLabelText("Example request")).toHaveTextContent("Authorization: Bearer test-token");
      expect(card).toHaveTextContent(/never saved or sent to the cloud/);

      const t = Date.now();
      const row = (offset: number, metric: string, value: number, unit: string) => ({ timestamp: new Date(t - offset * 1000).toISOString(), metric, value, unit, deviceId: "svc" });
      fake.send([...[5, 4, 3, 2, 1].flatMap((o, n) => [row(o, "heart_rate", 66 + (n % 3), "bpm"), row(o, "spo2", 97 + n / 10, "%")]), row(1, "heart_rate", 0, "bpm"), row(1, "spo2", 120, "%")]);
      await waitFor(() => expect(card).toHaveTextContent("readings received"));

      await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
      const strip = await screen.findByRole("region", { name: "Data source and quality" });
      expect(strip).toHaveTextContent("Connected service (webhook): Heart rate, Blood oxygen (SpO₂) · other signals simulated");
      expect(strip).toHaveTextContent("Webhook readings are display-only until a full day is collected");
      expect(strip).toHaveTextContent(/2 set aside/); // the lost-contact zero and the impossible SpO₂

      await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);
      expect(await screen.findAllByText("From a connected service (webhook).")).toHaveLength(2); // heart rate and SpO₂ only

      await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
      await user.click(await screen.findByRole("button", { name: "Stop receiving" }));
      await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
      await waitFor(() => expect(screen.getByRole("region", { name: "Data source and quality" })).toHaveTextContent("Source: Simulated wearable"));
    } finally { vi.unstubAllGlobals(); webhookTiming.pollMs = savedPoll; }
  });

  it("shows the pattern card on Home and Trends and changes it for Recovery concern, leaving alerts alone", async () => {
    const user = userEvent.setup();
    await openWorkspace("active");
    await waitForSignals();
    expect(await screen.findByText("PATTERN ACROSS SIGNALS")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Pattern score" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "recovery_concern");
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
    expect(await screen.findByText("Noticeably different from your usual pattern")).toBeInTheDocument();
    expect(screen.getByText(/Resting heart rate higher/)).toBeInTheDocument();
    expect(screen.getByText(/HRV lower/)).toBeInTheDocument();
    // The existing alert still comes from the existing rules.
    expect(screen.getByText(/Sleep was below your usual range on 4 of the last 5 days/)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Trends" })[0]);
    expect(await screen.findByText("Noticeably different from your usual pattern")).toBeInTheDocument();
  });

  it("pauses the pattern view when the sensor is disconnected", async () => {
    const user = userEvent.setup();
    await openWorkspace("active");
    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "sensor_disconnected");
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
    expect(await screen.findByText("Pattern view paused")).toBeInTheDocument();
  });

  it("explains the pattern on request with the built-in text when cloud is not configured", async () => {
    const user = userEvent.setup();
    await openWorkspace("active");
    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Demo scenario" }), "recovery_concern");
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
    await user.click(await screen.findByRole("button", { name: "Explain this pattern" }));
    expect(await screen.findByText("Built-in explanation")).toBeInTheDocument();
    expect(screen.getByText(/Cloud explanations are not set up/)).toBeInTheDocument();
    expect(screen.getByText(/Resting heart rate was higher/i)).toBeInTheDocument();
    expect(screen.getByText(/tell the crew medic/)).toBeInTheDocument();
  });

  /** Runs the webhook flow: start receiving, post rows, return to Home. */
  async function receiveWebhookRows(rows: (todayStart: number) => unknown[]) {
    const user = userEvent.setup();
    const fake = createFakeReceiver(() => Date.now());
    vi.stubGlobal("fetch", fake.fetchImpl);
    webhookTiming.pollMs = 30;
    await openWorkspace();
    await waitForSignals();
    await user.click(screen.getAllByRole("button", { name: "Profile" })[0]);
    const card = await screen.findByLabelText("Webhook source (local demo)", { selector: "div" });
    await user.click(await within(card).findByRole("button", { name: "Start receiving" }));
    await waitFor(() => expect(card).toHaveTextContent("Listening"));
    const now = new Date();
    fake.send(rows(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
    await waitFor(() => expect(card).toHaveTextContent("readings received"));
    await user.click(screen.getAllByRole("button", { name: "Home" })[0]);
    return await screen.findByRole("region", { name: "Data source and quality" });
  }
  const hr = (timestamp: number, value: number) => ({ timestamp: new Date(timestamp).toISOString(), metric: "heart_rate", value, unit: "bpm", deviceId: "svc" });
  const todayRows = (todayStart: number) => [1, 2, 3, 4, 5].map((k) => hr(todayStart + k * 1000, 64 + k * 0.1));

  it("raises an explained alert when a webhook delivers a fully covered day that differs from the person's usual pattern", async () => {
    const savedPoll = webhookTiming.pollMs;
    try {
      const strip = await receiveWebhookRows((todayStart) => [...Array.from({ length: 24 }, (_, h) => hr(todayStart - 86_400_000 + h * 3_600_000 + 1_800_000, 92 + h * 0.05)), ...todayRows(todayStart)]);
      await waitFor(() => expect(strip).toHaveTextContent("Alerts from: completed days of webhook readings"));
      expect(await screen.findByText(/Resting heart rate .* outside your usual range/)).toBeInTheDocument();
      expect(screen.getByText("A pattern is worth reviewing")).toBeInTheDocument();
    } finally { vi.unstubAllGlobals(); webhookTiming.pollMs = savedPoll; }
  });

  it("raises no alert from a webhook day that is only thinly covered, however different it looks", async () => {
    const savedPoll = webhookTiming.pollMs;
    try {
      const strip = await receiveWebhookRows((todayStart) => [95, 96, 94.5, 95.5].map((value, n) => hr(todayStart - 5 * 60_000 + n * 60_000, value)).concat(todayRows(todayStart)));
      expect(strip).toHaveTextContent("Webhook readings are display-only until a full day is collected");
      expect(screen.queryByText(/Resting heart rate .* outside your usual range/)).not.toBeInTheDocument();
      expect(screen.getByText("Your signals look usual")).toBeInTheDocument();
    } finally { vi.unstubAllGlobals(); webhookTiming.pollMs = savedPoll; }
  });

  it("fills the Active Wellbeing sliders from the demo voice check-in, and only saves when Save is pressed", async () => {
    const user = userEvent.setup();
    const savedStep = demoVoiceTiming.stepMs; demoVoiceTiming.stepMs = 5;
    try {
      await openWorkspace();
      await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
      expect(await screen.findByRole("heading", { name: "Check in by voice" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Try the demo voice" }));
      const review = await screen.findByRole("group", { name: "Review your answers" }, { timeout: 3000 });
      expect(window.localStorage.getItem("horizon:wellbeing")).not.toContain('"mood":"4"'); // nothing applied yet
      await user.click(within(review).getByRole("button", { name: "Fill in the form" }));
      expect(screen.getByLabelText("Mood")).toHaveValue("4");
      expect(screen.getByLabelText("Stress")).toHaveValue("2");
      expect(screen.getByLabelText("Sleep quality")).toHaveValue("3");
      expect(screen.queryByLabelText("Energy")).not.toBeInTheDocument(); // not on this page, so voice never asks about it
      expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Save check-in locally" }));
      expect(screen.getByText("Saved on this device")).toBeInTheDocument();
    } finally { demoVoiceTiming.stepMs = savedStep; }
  });
});
