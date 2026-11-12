import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { deviceTiming } from "./lib/useDeviceStream";
import { bluetoothTiming } from "./lib/useBluetoothHeartRate";
import { bluetoothAccess } from "./lib/adapters/webBluetoothHeartRate";
import { createFakeBluetooth, hrBytes } from "./test/fakeBluetooth";

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
    expect(screen.getByRole("button", { name: "Future traveler" })).toBeInTheDocument();
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
    expect(screen.getByRole("progressbar", { name: "Wearable connection progress" })).toBeInTheDocument();
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
    await user.selectOptions(screen.getByRole("combobox", { name: "Mood" }), "4");
    await user.selectOptions(screen.getByRole("combobox", { name: "Stress" }), "2");
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
    await user.selectOptions(screen.getByRole("combobox", { name: "Mood" }), "4");
    await user.selectOptions(screen.getByRole("combobox", { name: "Stress" }), "2");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sleep quality" }), "Mixed");
    await user.click(screen.getByRole("button", { name: "Save check-in locally" }));
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
  });

  it("opens local support options without sending a message", async () => {
    const user = userEvent.setup();
    await openWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    await user.click(screen.getByRole("button", { name: "Open support options" }));

    expect(screen.getByRole("region", { name: "Support options" })).toBeInTheDocument();
    expect(screen.getByText("Crew medic")).toBeInTheDocument();
    expect(screen.getByText(/This demo does not send messages/)).toBeInTheDocument();
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
    await user.click(screen.getByRole("checkbox", { name: "Private reflection" }));

    expect(JSON.parse(window.localStorage.getItem("horizon:retired-summary-fields") ?? "{}")).toMatchObject({ reflection: true });
  });

  it("restores local check-in state after reselecting a workspace on refresh", async () => {
    const user = userEvent.setup();
    const first = await openWorkspace();
    await user.selectOptions(screen.getByRole("combobox", { name: "Life stage" }), "retired");
    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    await user.selectOptions(screen.getByRole("combobox", { name: "Mood" }), "5");
    await user.click(screen.getByRole("button", { name: "Save check-in locally" }));
    first.unmount();

    await openWorkspace("retired");
    expect(screen.getByRole("combobox", { name: "Life stage" })).toHaveValue("retired");
    await user.click(screen.getAllByRole("button", { name: "Wellbeing" })[0]);
    expect(screen.getByRole("combobox", { name: "Mood" })).toHaveValue("5");
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
});
