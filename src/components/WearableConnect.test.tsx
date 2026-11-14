import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { WearableConnect } from "./WearableConnect";
import type { BodyDeviceId } from "../domain/bodyDevices";

function Harness({ onPair = vi.fn(), onUnpair = vi.fn(), paired = new Set<BodyDeviceId>(), pairing = null as BodyDeviceId | null }) {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  return <><WearableConnect on={on} open={open} paired={paired} pairing={pairing} onToggle={(next) => { setOn(next); setOpen(next); }} onOpenChange={setOpen} onPair={onPair} onUnpair={onUnpair} /><button type="button">Outside</button></>;
}

describe("Connect wearables switch", () => {
  it("starts off with no list, and switching on opens the device list", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole("switch", { name: "Connect wearables" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("region", { name: "Available wearables" })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    const list = screen.getByRole("region", { name: "Available wearables" });
    for (const name of ["Astroskin shirt", "Actiwatch", "Personal dosimeter", "Motion sensors"]) expect(within(list).getByText(name)).toBeInTheDocument();
  });

  it("closes the list on Escape or an outside click and reopens it from the label", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("switch", { name: "Connect wearables" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Available wearables" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Connect wearables/ }));
    expect(screen.getByRole("region", { name: "Available wearables" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("region", { name: "Available wearables" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Connect wearables" })).toHaveAttribute("aria-checked", "true");
  });

  it("pairs a device, shows Pairing… and offers disconnect once connected", async () => {
    const user = userEvent.setup();
    const onPair = vi.fn();
    const onUnpair = vi.fn();
    const view = render(<Harness onPair={onPair} onUnpair={onUnpair} />);
    await user.click(screen.getByRole("switch", { name: "Connect wearables" }));
    await user.click(screen.getByRole("button", { name: "Pair Actiwatch" }));
    expect(onPair).toHaveBeenCalledWith("actiwatch");
    view.rerender(<Harness onPair={onPair} onUnpair={onUnpair} pairing="actiwatch" />);
    await user.click(screen.getByRole("switch", { name: "Connect wearables" }));
    await user.click(screen.getByRole("switch", { name: "Connect wearables" }));
    expect(screen.getByRole("button", { name: "Pair Actiwatch" })).toHaveTextContent("Pairing…");
    expect(screen.getByRole("button", { name: "Pair Astroskin shirt" })).toBeDisabled();
    view.rerender(<Harness onPair={onPair} onUnpair={onUnpair} paired={new Set<BodyDeviceId>(["actiwatch"])} />);
    await user.click(screen.getByRole("switch", { name: "Connect wearables" }));
    await user.click(screen.getByRole("switch", { name: "Connect wearables" }));
    expect(screen.getByText("1 of 4 paired")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Disconnect Actiwatch" }));
    expect(onUnpair).toHaveBeenCalledWith("actiwatch");
  });
});
