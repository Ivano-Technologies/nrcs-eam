import { describe, expect, it, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const valuesMock = vi.fn();

vi.mock("../db", () => ({
  getDb: vi.fn(async () => ({
    insert: insertMock.mockReturnValue({
      values: valuesMock,
    }),
  })),
}));

import { createEmailService } from "./emailService";

describe("createEmailService", () => {
  beforeEach(() => {
    insertMock.mockClear();
    valuesMock.mockClear();
  });

  it("writes sent status on success", async () => {
    const svc = createEmailService({
      sendFn: vi.fn(async () => true),
    });
    const ok = await svc.send({
      type: "grn_finalized",
      to: "test@example.com",
      subject: "GRN finalized",
      html: "<p>ok</p>",
    });
    expect(ok).toBe(true);
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });

  it("writes failed status and does not throw", async () => {
    const svc = createEmailService({
      sendFn: vi.fn(async () => false),
    });
    const ok = await svc.send({
      type: "waybill_dispatched",
      to: "test@example.com",
      subject: "Waybill dispatched",
      html: "<p>fail</p>",
    });
    expect(ok).toBe(false);
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("retries once and marks sent when second succeeds", async () => {
    const sendFn = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const svc = createEmailService({ sendFn });
    const ok = await svc.send({
      type: "expiry_digest",
      to: "test@example.com",
      subject: "Digest",
      html: "<p>retry</p>",
    });
    expect(ok).toBe(true);
    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });
});
