import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ImportDataPanel } from "./ImportDataPanel";

const file = (name: string, text: string, type = "text/csv") => new File([text], name, { type });

describe("ImportDataPanel", () => {
  it("states that OrbitWell does not measure and that files stay on the device", () => {
    render(<ImportDataPanel personKey="active:maya" />);
    expect(screen.getByText(/does not measure anything itself/)).toBeInTheDocument();
    expect(screen.getByText(/not uploaded or saved/)).toBeInTheDocument();
  });

  it("cleans the messy sample, lists rejected rows with reasons, and explains the result", async () => {
    const user = userEvent.setup();
    render(<ImportDataPanel personKey="active:maya" />);
    await user.click(screen.getByRole("button", { name: "Try a messy sample file" }));
    const result = screen.getByRole("region", { name: "Import result" });

    expect(within(result).getByText(/readings accepted/)).toBeInTheDocument();
    // One consistent total: the "rows rejected" count and the note agree, including parser-level rejections.
    const rejected = Number(within(result).getByText(/rows rejected/).querySelector("span")!.textContent);
    expect(within(result).getByText(new RegExp(`^${rejected} of \\d+ rows could not be used`))).toBeInTheDocument();
    expect(within(result).getByText(/Likely lost sensor contact/)).toBeInTheDocument();
    expect(within(result).getByText(/Unknown metric "blood_sugar"/)).toBeInTheDocument();
    expect(within(result).getByText(/Timestamp is in the future/)).toBeInTheDocument();
    expect(within(result).getByText(/Duplicate reading/)).toBeInTheDocument();
    expect(within(result).getByText(/Expected 6 columns but found 8/)).toBeInTheDocument();
    expect(within(result).getByRole("status")).toHaveTextContent(/outside your usual range/);
    expect(within(result).getByRole("status")).toHaveTextContent(/Processed on this device only/);
    expect(result.textContent).not.toMatch(/diagnos(is|ed)\b|medical condition/i);
  });

  it("analyzes an uploaded file and never alerts on data that is mostly junk", async () => {
    const user = userEvent.setup();
    render(<ImportDataPanel personKey="active:maya" />);
    const junk = "timestamp,metric,value,unit\nnope,heart_rate,60,bpm\n2026-11-10T08:00:00Z,heart_rate,abc,bpm\n2026-11-10T08:01:00Z,fish,1,bpm";
    await user.upload(screen.getByLabelText("Choose a CSV or JSON file"), file("junk.csv", junk));

    const result = await screen.findByRole("region", { name: "Import result" });
    expect(within(result).getByText("junk.csv")).toBeInTheDocument();
    expect(result).toHaveTextContent("Data quality: poor");
    expect(within(result).getByRole("status")).toHaveTextContent("Not enough reliable data to assess");
    expect(within(result).queryByText(/outside your usual range/)).not.toBeInTheDocument();
  });

  it("reports an unreadable file and can be cleared", async () => {
    const user = userEvent.setup();
    render(<ImportDataPanel personKey="active:maya" />);
    await user.upload(screen.getByLabelText("Choose a CSV or JSON file"), file("bad.json", "{oops", "application/json"));
    expect(await screen.findByText(/File is not valid JSON/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("region", { name: "Import result" })).not.toBeInTheDocument();
  });
});
