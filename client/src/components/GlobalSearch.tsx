import { useAuth } from "@/_core/hooks/useAuth";
import { appPath } from "@/lib/routes";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const RECENT_KEY = "nrcs-global-search-recent-v1";
const MAX_RECENT = 8;

type RecentEntry = {
  id: string;
  label: string;
  href: string;
  group: string;
};

function loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecent(entries: RecentEntry[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

export function GlobalSearch({ className }: { className?: string }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const enabled = open && debounced.length >= 2;
  const { data, isFetching } = trpc.search.global.useQuery(
    { query: debounced },
    { enabled }
  );

  const pushRecent = useCallback((entry: RecentEntry) => {
    const prev = loadRecent().filter((x) => x.id !== entry.id);
    saveRecent([entry, ...prev]);
  }, []);

  const navigate = useCallback(
    (href: string, entry: RecentEntry) => {
      pushRecent(entry);
      setOpen(false);
      setQuery("");
      setDebounced("");
      setLocation(href);
    },
    [pushRecent, setLocation]
  );

  const recent = useMemo(() => loadRecent(), [open]);

  const mac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");
  const shortcut = mac ? "⌘K" : "Ctrl+K";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "hidden sm:inline-flex h-9 items-center gap-2 text-muted-foreground min-w-[200px] justify-start",
          className
        )}
        data-testid="global-search-trigger"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm">Search…</span>
        <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          {shortcut}
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="sm:hidden h-9 w-9"
        aria-label="Open search"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setQuery("");
            setDebounced("");
          }
        }}
        title="Search"
        description="Search assets, work orders, inventory, facilities, and users"
        className="max-w-xl"
      >
        <CommandInput
          placeholder="Type at least 2 characters…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.trim().length < 2 && recent.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {recent.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={r.id + r.label}
                    onSelect={() => {
                      navigate(r.href, r);
                    }}
                  >
                    <span className="truncate">{r.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{r.group}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          {enabled && isFetching && (
            <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
          )}
          {enabled && !isFetching && data && (
            <>
              {data.assets.length > 0 && (
                <CommandGroup heading="Assets">
                  {data.assets.map((a) => {
                    const href = appPath(`/assets/${a.id}`);
                    const entry: RecentEntry = {
                      id: `asset-${a.id}`,
                      label: `${a.name} (${a.assetTag})`,
                      href,
                      group: "Asset",
                    };
                    return (
                      <CommandItem
                        key={a.id}
                        value={`asset-${a.id}-${a.name}`}
                        onSelect={() => navigate(href, entry)}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{a.name}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {a.assetTag} · {a.status}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {data.workOrders.length > 0 && (
                <CommandGroup heading="Work Orders">
                  {data.workOrders.map((w) => {
                    const href = appPath(`/work-orders/${w.id}`);
                    const entry: RecentEntry = {
                      id: `wo-${w.id}`,
                      label: `${w.workOrderNumber} — ${w.title}`,
                      href,
                      group: "Work order",
                    };
                    return (
                      <CommandItem
                        key={w.id}
                        value={`wo-${w.id}-${w.workOrderNumber}`}
                        onSelect={() => navigate(href, entry)}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{w.workOrderNumber}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {w.title} · {w.status}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {data.inventory.length > 0 && (
                <CommandGroup heading="Inventory">
                  {data.inventory.map((it) => {
                    const href = appPath("/inventory/stock-overview");
                    const entry: RecentEntry = {
                      id: `inv-${it.id}`,
                      label: `${it.name} (${it.itemCode})`,
                      href,
                      group: "Inventory",
                    };
                    return (
                      <CommandItem
                        key={it.id}
                        value={`inv-${it.id}-${it.itemCode}`}
                        onSelect={() => navigate(href, entry)}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{it.name}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {it.itemCode} · stock {it.currentStock}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {data.sites.length > 0 && (
                <CommandGroup heading="Facilities">
                  {data.sites.map((s) => {
                    const href = appPath("/facilities");
                    const entry: RecentEntry = {
                      id: `site-${s.id}`,
                      label: s.name,
                      href,
                      group: "Site",
                    };
                    return (
                      <CommandItem
                        key={s.id}
                        value={`site-${s.id}-${s.name}`}
                        onSelect={() => navigate(href, entry)}
                      >
                        <span className="truncate">{s.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {isAdmin && data.users.length > 0 && (
                <CommandGroup heading="Users">
                  {data.users.map((u) => {
                    const href = appPath("/settings/users");
                    const entry: RecentEntry = {
                      id: `user-${u.id}`,
                      label: `${u.name ?? u.email ?? ""} (${u.role})`,
                      href,
                      group: "User",
                    };
                    return (
                      <CommandItem
                        key={u.id}
                        value={`user-${u.id}-${u.email}`}
                        onSelect={() => navigate(href, entry)}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{u.name ?? u.email}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {u.email} · {u.role}
                          </span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {(() => {
                const n =
                  data.assets.length +
                  data.workOrders.length +
                  data.inventory.length +
                  data.sites.length +
                  data.users.length;
                return n === 0 ? <CommandEmpty>No results found.</CommandEmpty> : null;
              })()}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
