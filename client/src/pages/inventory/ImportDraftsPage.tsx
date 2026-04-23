import { useState } from "react";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function ImportDraftsPage({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const drafts = trpc.inventoryV2.documents.drafts.list.useQuery();
  const selected = trpc.inventoryV2.documents.drafts.get.useQuery({ id: selectedId ?? 0 }, { enabled: selectedId != null });
  const finalize = trpc.inventoryV2.documents.drafts.finalize.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        toast.success("Draft finalized");
      } else {
        toast.error("Draft has validation errors");
      }
      void drafts.refetch();
      void selected.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const discard = trpc.inventoryV2.documents.drafts.discard.useMutation({
    onSuccess: () => {
      toast.success("Draft discarded");
      void drafts.refetch();
      setSelectedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!embedInShell ? (
        <>
          <h1 className="text-3xl font-bold">Import Drafts Inbox</h1>
          <InventorySecondaryNav />
        </>
      ) : (
        <h2 className="text-2xl font-bold">Import Drafts Inbox</h2>
      )}
      <Card>
        <CardContent className="pt-4">
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-2 text-left">Source</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-left">Rows</th>
                  <th className="px-2 py-2 text-left">Validation</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(drafts.data ?? []).map((draft) => (
                  <tr key={draft.id} className="border-t">
                    <td className="px-2 py-2">{draft.source}</td>
                    <td className="px-2 py-2">{draft.documentType}</td>
                    <td className="px-2 py-2">{draft.rowCount}</td>
                    <td className="px-2 py-2">{draft.validationStatus}</td>
                    <td className="px-2 py-2">{draft.status}</td>
                    <td className="px-2 py-2 space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(draft.id)}>Edit</Button>
                      <Button size="sm" onClick={() => finalize.mutate({ id: draft.id })}>Finalize</Button>
                      <Button size="sm" variant="destructive" onClick={() => discard.mutate({ id: draft.id })}>Discard</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selected.data ? (
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-2">Draft #{selected.data.id} rows</h3>
            <pre className="max-h-[420px] overflow-auto text-xs">{JSON.stringify(selected.data.rowsJson, null, 2)}</pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

