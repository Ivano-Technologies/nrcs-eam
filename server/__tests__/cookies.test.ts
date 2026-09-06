import { afterEach, describe, expect, it } from "vitest";
import type { Request } from "express";
import { deriveParentDomain, getSessionCookieOptions } from "../_core/cookies";

function reqFor(hostname: string, protocol: "http" | "https" = "https"): Request {
  return {
    hostname,
    protocol,
    headers: protocol === "https" ? { "x-forwarded-proto": "https" } : {},
  } as Request;
}

describe("session cookie domain", () => {
  const originalDomain = process.env.SESSION_COOKIE_DOMAIN;

  afterEach(() => {
    if (originalDomain === undefined) delete process.env.SESSION_COOKIE_DOMAIN;
    else process.env.SESSION_COOKIE_DOMAIN = originalDomain;
  });

  it("scopes *.techivano.com to .techivano.com so prod and blue share the session", () => {
    delete process.env.SESSION_COOKIE_DOMAIN;
    expect(deriveParentDomain(reqFor("nrcseam.techivano.com"))).toBe(".techivano.com");
    expect(deriveParentDomain(reqFor("blue.nrcseam.techivano.com"))).toBe(".techivano.com");
    expect(getSessionCookieOptions(reqFor("nrcseam.techivano.com")).domain).toBe(".techivano.com");
  });

  it("does not set Domain on *.vercel.app (public suffix; browsers reject .vercel.app)", () => {
    delete process.env.SESSION_COOKIE_DOMAIN;
    const preview = "nrcs-eam-git-fix-dashboard-cache-light-theme-techivano.vercel.app";
    expect(deriveParentDomain(reqFor(preview))).toBeUndefined();
    expect(getSessionCookieOptions(reqFor(preview)).domain).toBeUndefined();
    expect(deriveParentDomain(reqFor("nrcs-68ylrgiqn-techivano.vercel.app"))).toBeUndefined();
  });

  it("does not set Domain on localhost", () => {
    delete process.env.SESSION_COOKIE_DOMAIN;
    expect(deriveParentDomain(reqFor("localhost", "http"))).toBeUndefined();
    expect(getSessionCookieOptions(reqFor("localhost", "http")).domain).toBeUndefined();
  });

  it("treats an explicitly empty SESSION_COOKIE_DOMAIN as host-only", () => {
    process.env.SESSION_COOKIE_DOMAIN = "";
    expect(getSessionCookieOptions(reqFor("nrcseam.techivano.com")).domain).toBeUndefined();
    process.env.SESSION_COOKIE_DOMAIN = "   ";
    expect(getSessionCookieOptions(reqFor("blue.nrcseam.techivano.com")).domain).toBeUndefined();
  });

  it("also refuses other preview public suffixes", () => {
    delete process.env.SESSION_COOKIE_DOMAIN;
    expect(deriveParentDomain(reqFor("org.github.io"))).toBeUndefined();
    expect(deriveParentDomain(reqFor("app.pages.dev"))).toBeUndefined();
    expect(deriveParentDomain(reqFor("site.netlify.app"))).toBeUndefined();
  });
});
