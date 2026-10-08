import { describe, expect, it } from "vitest";
import { buttonVariants } from "./button";

describe("buttonVariants (Wave A1, A3, A5)", () => {
  it("draws a solid 2px focus ring (red in light, white in dark)", () => {
    const cls = buttonVariants();
    expect(cls).toContain("focus-visible:outline-solid");
    expect(cls).toContain("focus-visible:outline-2");
    expect(cls).toContain("focus-visible:outline-offset-2");
    expect(cls).toContain("focus-visible:outline-[#C8102E]");
    expect(cls).toContain("dark:focus-visible:outline-white");
    expect(cls).not.toContain("#EE1C25");
  });

  it("default variant uses the single brand red token", () => {
    const cls = buttonVariants({ variant: "default" });
    expect(cls).toContain("bg-primary");
    expect(cls).toContain("hover:bg-[#A50D26]");
    expect(cls).not.toMatch(/#EE1C25|#c8151c|#ef4444/i);
  });

  it("outline variant has a 3:1 border and light text in dark mode", () => {
    const cls = buttonVariants({ variant: "outline" });
    expect(cls).toContain("border-[#8A8F98]");
    expect(cls).toContain("dark:border-[#64768E]");
    expect(cls).toContain("dark:text-[#E6EAF0]");
    expect(cls).toContain("dark:hover:bg-white/[0.06]");
  });

  it.each(["default", "destructive", "outline", "secondary", "ghost", "link"] as const)(
    "%s variant uses the neutral disabled style instead of opacity",
    (variant) => {
      const cls = buttonVariants({ variant });
      expect(cls).toContain("disabled:opacity-100");
      expect(cls).toContain("disabled:bg-[#E5E7EB]");
      expect(cls).toContain("disabled:text-[#6B7280]");
      expect(cls).toContain("dark:disabled:bg-[#2A2A2A]");
      expect(cls).toContain("dark:disabled:text-[#8B8B8B]");
      expect(cls).not.toContain("disabled:opacity-50");
    },
  );
});
