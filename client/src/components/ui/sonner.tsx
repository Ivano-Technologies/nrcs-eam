import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useEffect } from "react";

/** Tag Sonner toasts for Playwright: `[data-testid="toast-success"]` on success toasts. */
function useToastTestIds() {
  useEffect(() => {
    const tag = () => {
      document.querySelectorAll("[data-sonner-toast]").forEach((el) => {
        const type = el.getAttribute("data-type");
        if (type === "success") el.setAttribute("data-testid", "toast-success");
        else el.removeAttribute("data-testid");
      });
    };
    tag();
    const obs = new MutationObserver(tag);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "light" } = useTheme();
  useToastTestIds();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
