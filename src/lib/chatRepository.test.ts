import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createChatRepository } from "./chatRepository";

describe("chat response boundary", () => {
  it("never invokes cloud AI for a glucose or injection request", async () => {
    const invoke = vi.fn();
    const repository = createChatRepository({ functions: { invoke } } as unknown as SupabaseClient, "user");
    const result = await repository.sendMessage("conversation", "active", "I'm losing blood sugar. Inject insulin?");
    expect(invoke).not.toHaveBeenCalled();
    expect(result.data?.source).toBe("built-in");
    expect(result.data?.content).toContain("Suspected low sugar: no insulin");
    expect(result.data?.details).toContain("do not use it to treat suspected low blood sugar");
  });
  it("rejects unsafe output even from an older deployed function", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { message: { content: "Inject insulin now." } } });
    const repository = createChatRepository({ functions: { invoke } } as unknown as SupabaseClient, "user");
    const result = await repository.sendMessage("conversation", "active", "What should I do?");
    expect(result.data?.source).toBe("built-in");
    expect(result.data?.content).not.toContain("Inject insulin now.");
    expect(result.warning).toContain("could not be shown");
  });
  it("allows only the exact sanitized urgent-topic research query to reach cloud AI", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { message: { id: "a", role: "assistant", content: "NASA studies respiratory health in flight. [1]", created_at: "2026-11-14", status: "complete", answer_kind: "nasa_grounded", citations: [{ id: "source", title: "NASA source", url: "https://www.nasa.gov/example/", collection: "NASA", excerpt: "Evidence" }] } }, error: null });
    const repository = createChatRepository({ functions: { invoke } } as unknown as SupabaseClient, "user");
    await repository.sendMessage("conversation", "active", "What does NASA documentation report about respiratory concerns during human spaceflight?", { sanitizedFromTopic: "breathing" });
    expect(invoke).toHaveBeenCalledWith("chat-assistant", { body: expect.objectContaining({ sanitizedFromTopic: "breathing" }) });
    expect(JSON.stringify(invoke.mock.calls)).not.toContain("I'm having trouble breathing");
  });
  it("also filters unsafe historical assistant messages while preserving user messages", async () => {
    const result = { data: [
      { id: "1", role: "user", content: "Insulin?", created_at: "2026-11-13" },
      { id: "2", role: "assistant", content: "Inject insulin now.", created_at: "2026-11-13" },
    ] };
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(result) };
    const repository = createChatRepository({ from: vi.fn(() => query) } as unknown as SupabaseClient, "user");
    const history = await repository.listMessages("conversation");
    expect(history.data[0].content).toBe("Insulin?");
    expect(history.data[1].source).toBe("built-in");
    expect(history.data[1].content).not.toContain("Inject insulin now.");
  });
});
