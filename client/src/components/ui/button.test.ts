import { describe, expect, it } from "vitest";
import { buttonVariants } from "./button";

describe("buttonVariants (Wave A1, A3, A5)", () => {
  it("draws a solid 2px focus ring (red in light, white in dark)", () => {
    const cls = buttonVariants();
    expect(cls).toContain("focus-visible:outline-solid");
    expect(cls).toContain("focus-visible:outline-2");
    expect(cls).toContain("focus-visible:outline-offset-2");
    expect(cls).toContain("focus-visible:outline-primary");
    expect(cls).toContain("dark:focus-visible:outline-white");
    expect(cls).not.toContain("#EE1C25");
  });

  it("default variant uses the single brand red token", () => {
    const cls = buttonVariants({ variant: "default" });
    expect(cls).toContain("bg-primary");
    expect(cls).toContain("hover:bg-primary-hover");
    expect(cls).not.toMatch(/#EE1C25|#c8151c|#ef4444/i);
  });

  it("outline variant has a 3:1 border and light text in dark mode", () => {
    const cls = buttonVariants({ variant: "outline" });
    expect(cls).toContain("border-control-border");
    expect(cls).toContain("dark:border-control-border");
    expect(cls).toContain("dark:text-foreground-strong");
    expect(cls).toContain("dark:hover:bg-white/[0.06]");
  });

  it.each(["default", "destructive", "outline", "secondary", "ghost", "link"] as const)(
    "%s variant uses the neutral disabled style instead of opacity",
    (variant) => {
      const cls = buttonVariants({ variant });
      expect(cls).toContain("disabled:opacity-100");
      expect(cls).toContain("disabled:bg-disabled");
      expect(cls).toContain("disabled:text-disabled-foreground");
      expect(cls).toContain("dark:disabled:bg-disabled");
      expect(cls).toContain("dark:disabled:text-disabled-foreground");
      expect(cls).not.toContain("disabled:opacity-50");
    },
  );
});
