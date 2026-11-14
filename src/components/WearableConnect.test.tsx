import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WearableConnect } from "./WearableConnect";
import { bodyDeviceTiming, type BodyDeviceId } from "../domain/bodyDevices";

function Harness({ onPair = vi.fn(), onUnpair = vi.fn(), paired = new Set<BodyDeviceId>(), pairing = null as BodyDeviceId | null }) {
  const [open, setOpen] = useState(false);
  return <><WearableConnect open={open} paired={paired} pairing={pairing} onOpenChange={setOpen} onPair={onPair} onUnpair={onUnpair} /><button type="button">Outside</button></>;
}

describe("Connect wearables button", () => {
  beforeEach(() => { bodyDeviceTiming.scanMs = 10; });

  it("has no switch; each click opens the list after a short search", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Connect wearables" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(screen.getByRole("status")).toHaveTextContent("Searching for nearby devices…");
    const list = await screen.findByRole("region", { name: "Available wearables" });
    expect(await within(list).findByText("Astroskin shirt")).toBeInTheDocument();
    for (const name of ["Actiwatch", "Personal dosimeter", "Motion sensors"]) expect(within(list).getByText(name)).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByRole("region", { name: "Available wearables" })).not.toBeInTheDocument();
    await user.click(button);
    expect(await screen.findByText("Astroskin shirt")).toBeInTheDocument();
  });

  it("closes on Escape or an outside click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Connect wearables" }));
    await screen.findByText("Astroskin shirt");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Available wearables" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Connect wearables" }));
    await screen.findByText("Astroskin shirt");
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("region", { name: "Available wearables" })).not.toBeInTheDocument();
  });

  it("pairs, shows Pairing…, and offers disconnect with a connected count", async () => {
    const user = userEvent.setup();
    const onPair = vi.fn();
    const onUnpair = vi.fn();
    const view = render(<Harness onPair={onPair} onUnpair={onUnpair} />);
    await user.click(screen.getByRole("button", { name: "Connect wearables" }));
    await user.click(await screen.findByRole("button", { name: "Pair Actiwatch" }));
    expect(onPair).toHaveBeenCalledWith("actiwatch");
    view.rerender(<Harness onPair={onPair} onUnpair={onUnpair} pairing="actiwatch" />);
    expect(await screen.findByRole("button", { name: "Pair Actiwatch" })).toHaveTextContent("Pairing…");
    expect(screen.getByRole("button", { name: "Pair Astroskin shirt" })).toBeDisabled();
    view.rerender(<Harness onPair={onPair} onUnpair={onUnpair} paired={new Set<BodyDeviceId>(["actiwatch"])} />);
    const button = screen.getByRole("button", { name: /^Connect wearables/ });
    expect(button).toHaveTextContent("1/4");
    expect(await screen.findByText("1 of 4 paired")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Disconnect Actiwatch" }));
    expect(onUnpair).toHaveBeenCalledWith("actiwatch");
  });
});
