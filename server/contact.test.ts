import { afterEach, describe, expect, it, vi } from "vitest";
import { contactInputSchema } from "./contact";

describe("contact request validation", () => {
  const base = { topic: "new_site" as const, phone: "01125839109", website: "" };

  it("accepts an Egyptian mobile and normalises it to E.164", () => {
    const parsed = contactInputSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.phone).toBe("+201125839109");
  });

  it("accepts an international number", () => {
    const parsed = contactInputSchema.safeParse({ ...base, phone: "+447911123456" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid phone number", () => {
    const parsed = contactInputSchema.safeParse({ ...base, phone: "123" });
    expect(parsed.success).toBe(false);
  });

  it("treats an empty email as absent", () => {
    const parsed = contactInputSchema.safeParse({ ...base, clientEmail: "" });
    expect(parsed.success && parsed.data.clientEmail).toBeUndefined();
  });

  it("rejects a malformed email", () => {
    const parsed = contactInputSchema.safeParse({ ...base, clientEmail: "not-an-email" });
    expect(parsed.success).toBe(false);
  });

  it("only allows the three known topics", () => {
    expect(contactInputSchema.safeParse({ ...base, topic: "existing_issue" }).success).toBe(true);
    expect(contactInputSchema.safeParse({ ...base, topic: "hack" }).success).toBe(false);
  });

  // The honeypot must be empty for a real person; a filled value is a bot.
  it("rejects a filled honeypot at the schema level", () => {
    const parsed = contactInputSchema.safeParse({ ...base, website: "http://spam.example.com" });
    expect(parsed.success).toBe(false);
  });
});

describe("contact request delivery", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("emails the owner and reports delivery", async () => {
    vi.resetModules();
    const email = await import("./email");
    const spy = vi
      .spyOn(email, "sendContactLeadEmail")
      .mockResolvedValue({ status: "sent", messageId: "abc" });

    const { submitContactRequest } = await import("./contact");
    const result = await submitContactRequest(
      { topic: "existing_issue", phone: "+201125839109", clientEmail: undefined, note: undefined, website: "" },
      {} as never,
    );

    expect(spy).toHaveBeenCalledOnce();
    expect(result.accepted).toBe(true);
  });

  // A bot that slips a filled honeypot past the UI is dropped without sending,
  // and still gets a success response so it learns nothing.
  it("silently drops a filled honeypot without emailing", async () => {
    vi.resetModules();
    const email = await import("./email");
    const spy = vi.spyOn(email, "sendContactLeadEmail");

    const { submitContactRequest } = await import("./contact");
    const result = await submitContactRequest(
      { topic: "new_site", phone: "+201125839109", clientEmail: undefined, note: undefined, website: "x" },
      {} as never,
    );

    expect(spy).not.toHaveBeenCalled();
    expect(result.accepted).toBe(true);
  });
});
