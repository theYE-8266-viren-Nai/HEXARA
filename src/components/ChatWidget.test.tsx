import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatWidget } from "./ChatWidget";
import type { ChatSendResult } from "../domain/chat";

const mock = vi.hoisted(() => ({ listConversations: vi.fn(), createConversation: vi.fn(), listMessages: vi.fn(), sendMessage: vi.fn() }));
vi.mock("../lib/chatRepository", () => ({ createChatRepository: () => mock }));
const props = { stage: "active" as const, client: null, userId: null };
const reply = { id: "reply", role: "assistant" as const, content: "Keep a regular routine.", createdAt: "2026-11-13", status: "complete" as const, source: "cloud" as const };

async function open() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open ORBIT companion" }));
  await waitFor(() => expect(screen.queryByText("Loading saved conversation…")).not.toBeInTheDocument());
  return user;
}

describe("ORBIT floating companion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.listConversations.mockResolvedValue({ data: [], warning: "Cloud chat is unavailable." });
    mock.createConversation.mockResolvedValue({ data: undefined, warning: "Not saved remotely." });
    mock.listMessages.mockResolvedValue({ data: [] });
    mock.sendMessage.mockResolvedValue({ data: reply });
  });

  it("opens accessibly, focuses the question, and closes with Escape", async () => {
    render(<ChatWidget {...props} />);
    const user = await open();
    expect(screen.getByRole("dialog", { name: "ORBIT AI" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Chat question" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open ORBIT companion" })).toHaveFocus();
  });

  it("starts an urgent conversation directly without a condition picker", async () => {
    render(<ChatWidget {...props} />);
    const user = await open();
    expect(screen.getByText("Hey, I'm ORBIT.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Blood sugar concern" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "I need urgent help" }));
    expect(screen.getByRole("log")).toHaveTextContent("Contact your crew medic and mission control now");
    expect(screen.getByRole("log")).toHaveTextContent("No one has been contacted");
    expect(screen.queryByRole("complementary", { name: "Emergency support steps" })).not.toBeInTheDocument();
    expect(mock.sendMessage).not.toHaveBeenCalled();
    expect(mock.createConversation).not.toHaveBeenCalled();
  });

  it("keeps a typed insulin emergency local and preserves it on reopening", async () => {
    render(<ChatWidget {...props} />);
    const user = await open();
    await user.type(screen.getByRole("textbox"), "My blood sugar is low. Should I inject insulin?");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(screen.getByRole("log")).toHaveTextContent("Built-in");
    const assistantMessage = screen.getByRole("log").querySelector(".chat-message.assistant")!;
    expect(assistantMessage.querySelector(":scope > p")!.textContent!.trim().split(/\s+/).length).toBeLessThanOrEqual(30);
    expect(assistantMessage.querySelector("details")).not.toHaveAttribute("open");
    await user.click(within(assistantMessage as HTMLElement).getByText("More guidance"));
    expect(assistantMessage.querySelector("details")).toHaveAttribute("open");
    expect(screen.getByRole("log")).toHaveTextContent("does not measure blood glucose");
    await user.click(screen.getByRole("button", { name: "Close chat" }));
    await open();
    expect(screen.getByRole("log")).toHaveTextContent("do not use it to treat suspected low blood sugar");
    expect(mock.listConversations).toHaveBeenCalledTimes(1);
    expect(mock.sendMessage).not.toHaveBeenCalled();
  });

  it("offers an honest offline answer to everyday questions", async () => {
    render(<ChatWidget {...props} />);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "How can I support my wellbeing today?" }));
    expect(await screen.findByText(/Built-in reply; cloud AI unavailable/)).toBeInTheDocument();
    expect(screen.getByText("Not saved remotely.")).toBeInTheDocument();
  });

  it("opens from retired Home and offers an honest Earth-view conversation offline", async () => {
    const view = render(<ChatWidget {...props} stage="retired" openRequest={0} />);
    view.rerender(<ChatWidget {...props} stage="retired" openRequest={1} />);
    const user = userEvent.setup();
    expect(await screen.findByRole("dialog", { name: "ORBIT AI" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Loading saved conversation…")).not.toBeInTheDocument());
    expect(screen.getByText("There's room for your story here.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "I miss the view of Earth" }));
    expect(await screen.findByText(/What part of seeing Earth feels most present today/)).toBeInTheDocument();
    expect(mock.sendMessage).not.toHaveBeenCalled();
  });

  it("sends regular questions with dashboard sharing off by default and recovers from rejection", async () => {
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    mock.sendMessage.mockRejectedValue(new Error("network down"));
    render(<ChatWidget {...props} context={{ stage: "active", signals: [] }} />);
    const user = await open();
    await user.click(screen.getByText("Chat privacy"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await user.type(screen.getByRole("textbox"), "How do I build a routine?");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    await screen.findByText(/Built-in reply; not saved remotely/);
    expect(mock.sendMessage).toHaveBeenCalledWith("conversation", "active", "How do I build a routine?", false, { stage: "active", signals: [] });
    expect(screen.queryByText("ORBIT is thinking…")).not.toBeInTheDocument();
  });

  it("answers emergencies immediately while cloud history is loading", async () => {
    let resolve!: (value: { data: [] }) => void;
    mock.listConversations.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<ChatWidget {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Open ORBIT companion" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "I can't breathe" } });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    expect(screen.getByRole("log")).toHaveTextContent("Do not wait for this chat");
    await act(async () => resolve({ data: [] }));
    expect(screen.getByRole("log")).toHaveTextContent("Do not wait for this chat");
  });

  it("discards late cloud responses when the stage changes", async () => {
    let resolve!: (value: ChatSendResult) => void;
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    mock.sendMessage.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<ChatWidget {...props} />);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "How can I support my wellbeing today?" }));
    await waitFor(() => expect(mock.sendMessage).toHaveBeenCalled());
    view.rerender(<ChatWidget {...props} stage="retired" />);
    await act(async () => resolve({ data: reply }));
    expect(screen.queryByText(reply.content)).not.toBeInTheDocument();
    expect(screen.getByText("Retired astronaut support")).toBeInTheDocument();
  });
  it("keeps urgent help available while waiting for cloud AI", async () => {
    let resolve!: (value: ChatSendResult) => void;
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    mock.sendMessage.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<ChatWidget {...props} />);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "How can I support my wellbeing today?" }));
    await screen.findByText("ORBIT is thinking…");
    await user.type(screen.getByRole("textbox"), "My blood sugar is dropping");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(screen.getByRole("log")).toHaveTextContent("do not use it to treat suspected low blood sugar");
    expect(mock.sendMessage).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ data: reply }));
    expect(screen.queryByText(reply.content)).not.toBeInTheDocument();
  });

  it.each([
    ["I'm bleeding", "firm pressure"],
    ["My chest hurts", "Stop exertion"],
    ["My lips are swelling", "emergency allergy plan"],
    ["My friend is having a seizure", "anything in the person's mouth"],
    ["I swallowed a chemical cleaner", "Do not make the person vomit"],
    ["The cabin pressure alarm went off", "onboard emergency checklist"],
  ])("responds conversationally to %s", async (message, detail) => {
    render(<ChatWidget {...props} />);
    const user = await open();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: message } });
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(screen.getByRole("log")).toHaveTextContent(detail);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-pet-state", "support");
    expect(mock.sendMessage).not.toHaveBeenCalled();
  });

  it("listens to symptoms and keeps short follow-ups in the same local conversation", async () => {
    render(<ChatWidget {...props} />);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "I'm not feeling well" }));
    expect(screen.getByRole("log")).toHaveTextContent("What are you feeling, and when did it start?");
    await user.type(screen.getByRole("textbox"), "Now I can't breathe");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(screen.getByRole("log")).toHaveTextContent("speak, cough, or breathe");
    await user.click(screen.getByRole("button", { name: "I'm alone" }));
    expect(screen.getByRole("log")).toHaveTextContent("backup mission emergency channel");
    await user.type(screen.getByRole("textbox"), "No");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    await user.click(screen.getByRole("button", { name: "What should I tell the medic?" }));
    expect(screen.getByRole("log")).toHaveTextContent("Do not use OrbitWell's simulated values");
    expect(mock.createConversation).not.toHaveBeenCalled();
    expect(mock.sendMessage).not.toHaveBeenCalled();
  });

  it("lets the user explicitly return to everyday cloud chat without uploading the symptom exchange", async () => {
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    render(<ChatWidget {...props} />);
    const user = await open();
    await user.click(screen.getByRole("button", { name: "I need urgent help" }));
    await user.click(screen.getByRole("button", { name: "Return to everyday chat" }));
    await user.type(screen.getByRole("textbox"), "How do I build a routine?");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    await screen.findByText(reply.content);
    expect(mock.sendMessage).toHaveBeenCalledWith("conversation", "active", "How do I build a routine?", false, undefined);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-pet-state", "listening");
  });
});
