import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatWidget } from "./ChatWidget";
import type { ChatSendResult } from "../domain/chat";

const mock = vi.hoisted(() => ({ listConversations: vi.fn(), createConversation: vi.fn(), listMessages: vi.fn(), sendMessage: vi.fn() }));
vi.mock("../lib/chatRepository", () => ({ createChatRepository: () => mock }));
const props = { stage: "active" as const, client: null, userId: null };
const citation = { id: "nasa-human-body-space", title: "The Human Body in Space", url: "https://www.nasa.gov/humans-in-space/the-human-body-in-space/", collection: "NASA Human Research", excerpt: "Microgravity changes balance and orientation." };
const reply = { id: "reply", role: "assistant" as const, content: "Microgravity changes vestibular inputs and orientation. [1]", createdAt: "2026-11-14", status: "complete" as const, source: "cloud" as const, answerKind: "nasa_grounded" as const, citations: [citation], category: "health_human_spaceflight" as const, confidence: "high" as const, keyPoints: ["NASA studies vestibular adaptation. [1]"], nextSteps: ["Review the cited NASA source."], warnings: ["This is educational context, not a personal assessment."], questionsToExplore: ["Would you like a simpler explanation?"] };

async function open() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open ORBIT assistant" }));
  await waitFor(() => expect(screen.queryByText("Loading saved NASA research…")).not.toBeInTheDocument());
  return user;
}

describe("ORBIT NASA research assistant", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.listConversations.mockResolvedValue({ data: [], warning: "Cloud chat is unavailable." });
    mock.createConversation.mockResolvedValue({ data: undefined, warning: "Not saved remotely." });
    mock.listMessages.mockResolvedValue({ data: [] });
    mock.sendMessage.mockResolvedValue({ data: reply });
  });

  it("opens accessibly as a NASA research assistant", async () => {
    render(<ChatWidget {...props} />); const user = await open();
    expect(screen.getByRole("dialog", { name: "ORBIT AI" })).toBeInTheDocument();
    expect(screen.getByText("NASA RESEARCH ASSISTANT")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "NASA research question" })).toHaveFocus();
    expect(screen.getByRole("button", { name: /Health in space/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "I'm not feeling well" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends an ordinary NASA question to the cloud repository", async () => {
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    render(<ChatWidget {...props} />); const user = await open();
    await user.click(screen.getByRole("button", { name: /Mission support/i }));
    expect(await screen.findByText(/Microgravity changes vestibular inputs/)).toBeInTheDocument();
    expect(mock.sendMessage).toHaveBeenCalledWith("conversation", "active", "Why does the ISS use control moment gyroscopes?", { category: "missions_engineering", inputMode: "text", sanitizedFromTopic: undefined });
  });

  it("keeps suggested questions available after the first question, without repeating it", async () => {
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    render(<ChatWidget {...props} />); const user = await open();
    await user.click(screen.getByRole("button", { name: /Mission support/i }));
    await screen.findByText(/Microgravity changes vestibular inputs/);
    const suggestions = screen.getByRole("group", { name: "Suggested questions" });
    expect(suggestions).toBeInTheDocument();
    expect(within(suggestions).queryByRole("button", { name: /Mission support/i })).not.toBeInTheDocument();
    await user.click(within(suggestions).getByRole("button", { name: /Health in space/i }));
    expect(mock.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("labels general health answers as non-NASA, non-personal information", async () => {
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    mock.sendMessage.mockResolvedValue({ data: { ...reply, id: "health", content: "Regular sleep and wake times help many people sleep better.", answerKind: "general_health", citations: [], keyPoints: ["Keep a consistent schedule."] } });
    render(<ChatWidget {...props} />); const user = await open();
    await user.type(screen.getByRole("textbox"), "What causes headaches?");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(await screen.findByText("ORBIT · General health information")).toBeInTheDocument();
    expect(screen.getByText(/not from NASA sources and not personal medical advice/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /MedlinePlus health topics/ })).toHaveAttribute("href", "https://medlineplus.gov/healthtopics.html");
    expect(screen.queryByText("Related NASA resources")).not.toBeInTheDocument();
    expect(mock.sendMessage).toHaveBeenCalledWith("conversation", "active", "What causes headaches?", expect.objectContaining({ category: "health_human_spaceflight" }));
  });

  it("does not misroute an educational radiation question as an emergency", async () => {
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    render(<ChatWidget {...props} />); const user = await open();
    await user.click(screen.getByRole("button", { name: /Health in space/i }));
    expect(mock.sendMessage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Do not wait for this chat/)).not.toBeInTheDocument();
  });

  it("renders numbered NASA source cards for grounded responses", async () => {
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    render(<ChatWidget {...props} />); const user = await open();
    await user.click(screen.getByRole("button", { name: /Health in space/i }));
    expect(await screen.findByText("ORBIT · NASA-grounded AI response")).toBeInTheDocument();
    const link = screen.getAllByRole("link", { name: /The Human Body in Space/ }).find((candidate) => candidate.textContent?.includes("[1]"))!;
    expect(link).toHaveAttribute("href", citation.url);
    expect(link).toHaveTextContent("[1] NASA Human Research");
  });

  it("renders the structured answer card and official related resources", async () => {
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    render(<ChatWidget {...props} />); const user = await open();
    await user.click(screen.getByRole("button", { name: /Health in space/i }));
    expect(await screen.findByText("Key points")).toBeInTheDocument();
    expect(screen.getByText("Useful next steps")).toBeInTheDocument();
    expect(screen.getByText("Related NASA resources")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
  });

  it("shows urgent guidance locally, then requires confirmation of a sanitized NASA query", async () => {
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    render(<ChatWidget {...props} />); const user = await open();
    await user.type(screen.getByRole("textbox"), "I'm having trouble breathing");
    await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(screen.getByRole("log")).toHaveTextContent("Contact your crew medic and mission control now");
    expect(mock.sendMessage).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Ask NASA about this topic/i }));
    expect(screen.getByRole("group", { name: "Confirm sanitized NASA research question" })).toHaveTextContent("respiratory concerns during human spaceflight");
    await user.click(screen.getByRole("button", { name: "Send sanitized question" }));
    await waitFor(() => expect(mock.sendMessage).toHaveBeenCalledWith("conversation", "active", "What does NASA documentation report about respiratory concerns during human spaceflight?", { category: "health_human_spaceflight", sanitizedFromTopic: "breathing" }));
    expect(mock.sendMessage.mock.calls.flat().join(" ")).not.toContain("I'm having trouble breathing");
  });

  it("gives Earth users a one-tap emergency call instead of crew-medic wording", async () => {
    render(<ChatWidget {...props} stage="retired" />); const user = await open();
    await user.click(screen.getByRole("button", { name: /I need urgent help/i }));
    const log = screen.getByRole("log");
    expect(log).toHaveTextContent("Call emergency services now.");
    expect(log).not.toHaveTextContent(/crew medic/i);
    expect(screen.getByRole("link", { name: /Call emergency services \(112\)/ })).toHaveAttribute("href", "tel:112");
    expect(screen.getByRole("group", { name: "Get help now" })).toHaveTextContent("OrbitWell has not contacted anyone.");
    expect(mock.sendMessage).not.toHaveBeenCalled();
  });

  it("keeps crew wording in space and offers no phone call", async () => {
    render(<ChatWidget {...props} />); const user = await open();
    await user.click(screen.getByRole("button", { name: /I need urgent help/i }));
    expect(screen.getByRole("log")).toHaveTextContent("Contact crew medic now");
    expect(screen.queryByRole("link", { name: /Call emergency services/ })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Get help now" })).toHaveTextContent("mission's emergency channel");
  });

  it("keeps urgent guidance available while cloud research is pending", async () => {
    let resolve!: (value: ChatSendResult) => void;
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    mock.sendMessage.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<ChatWidget {...props} />); const user = await open();
    await user.click(screen.getByRole("button", { name: /Health in space/i }));
    await screen.findByText("ORBIT is searching and checking NASA sources…");
    fireEvent.click(screen.getByRole("button", { name: "I need urgent help" }));
    expect(screen.getByRole("log")).toHaveTextContent("Do not wait for this chat");
    await act(async () => resolve({ data: reply }));
    expect(screen.queryByText(reply.content)).not.toBeInTheDocument();
  });

  it("shows the explicit no-evidence response without source cards", async () => {
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    mock.sendMessage.mockResolvedValue({ data: { ...reply, answerKind: "no_evidence", content: "I couldn’t verify that from the indexed NASA documents. Try a narrower question.", citations: [] } });
    render(<ChatWidget {...props} />); const user = await open();
    await user.type(screen.getByRole("textbox"), "An unsupported question"); await user.click(screen.getByRole("button", { name: "Send question" }));
    expect(await screen.findByText("ORBIT · No verified NASA source")).toBeInTheDocument();
    expect(screen.queryByLabelText("NASA sources")).not.toBeInTheDocument();
  });

  it("discards a late response when the life stage changes", async () => {
    let resolve!: (value: ChatSendResult) => void;
    mock.createConversation.mockResolvedValue({ data: { id: "conversation" } });
    mock.sendMessage.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<ChatWidget {...props} />); const user = await open();
    await user.click(screen.getByRole("button", { name: /Health in space/i }));
    view.rerender(<ChatWidget {...props} stage="retired" />);
    await act(async () => resolve({ data: reply }));
    expect(screen.queryByText(reply.content)).not.toBeInTheDocument();
  });

  it("opens from retired Home and keeps personal conversation out of cloud research", async () => {
    const view = render(<ChatWidget {...props} stage="retired" openRequest={0} />);
    view.rerender(<ChatWidget {...props} stage="retired" openRequest={1} />);
    expect(await screen.findByRole("dialog", { name: "ORBIT AI" })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "I miss the view of Earth" }));
    expect(screen.getByRole("log")).toHaveTextContent("What part of seeing Earth feels most present today?");
    expect(mock.createConversation).not.toHaveBeenCalled();
    expect(mock.sendMessage).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Explore NASA research" }));
    expect(screen.getByText("NASA RESEARCH ASSISTANT")).toBeInTheDocument();
    expect(screen.queryByText("What part of seeing Earth feels most present today?")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Return to private chat" }));
    expect(screen.getByRole("log")).toHaveTextContent("What part of seeing Earth feels most present today?");
  });
});
