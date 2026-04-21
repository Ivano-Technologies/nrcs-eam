import { Link, useLocation } from "wouter";
import { appPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Overview", path: appPath("/inventory") },
  { label: "Catalogue", path: appPath("/inventory") },
  { label: "Receipts", path: appPath("/inventory/receipts") },
  { label: "Issues", path: appPath("/inventory/issues") },
  { label: "Transfers", path: appPath("/inventory/transfers") },
  { label: "Movements", path: appPath("/inventory/movements") },
];

export function InventorySecondaryNav() {
  const [location] = useLocation();
  return (
    <div className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active =
          link.path === appPath("/inventory")
            ? location === appPath("/inventory")
            : location.startsWith(link.path);
        return (
          <Link key={link.path} href={link.path}>
            <a
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {link.label}
            </a>
          </Link>
        );
      })}
    </div>
  );
}
