import { useMemo, useState } from "react";
import { InventorySecondaryNav } from "@/components/inventory/InventorySecondaryNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useBulkImportFileInput } from "@/hooks/useBulkImportFileInput";

type DocType = "grn" | "waybill" | "monthly_report" | "stock_card";
type SourceType = "excel" | "pdf";

export default function ImportPage({ embedInShell = false }: { embedInShell?: boolean } = {}) {
  const [docType, setDocType] = useState<DocType>("grn");
  const [source, setSource] = useState<SourceType>("excel");
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const templateQuery = trpc.inventoryV2.documents.downloadTemplate.useQuery({ type: docType });
  const parseExcel = trpc.inventoryV2.documents.parseExcelImport.useMutation();
  const parsePdf = trpc.inventoryV2.documents.parseTypedPdfImport.useMutation();
  const createDraft = trpc.inventoryV2.documents.drafts.create.useMutation({
    onSuccess: () => toast.success("Draft saved"),
    onError: (e) => toast.error(e.message),
  });

  const hasError = useMemo(() => rows.some((r) => r.status === "error"), [rows]);

  const pipelineFileImport = useBulkImportFileInput({
    accept: source === "excel" ? ".xlsx" : ".pdf",
    isPending: parseExcel.isPending || parsePdf.isPending,
    prepareFile: "base64",
    onError: (m) => toast.error(m),
    run: async (base64, file): Promise<void> => {
      setFileName(file.name);
      const parsed =
        source === "excel"
          ? await parseExcel.mutateAsync({ type: docType, base64File: base64 })
          : await parsePdf.mutateAsync({
              type: docType === "waybill" ? "waybill" : "grn",
              base64File: base64,
            });
      setRows(parsed);
    },
  });

  const downloadTemplate = () => {
    const data = templateQuery.data;
    if (!data) return;
    const bytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: data.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {!embedInShell ? (
        <>
          <h1 className="text-3xl font-bold">Import Pipeline</h1>
          <InventorySecondaryNav />
        </>
      ) : (
        <h2 className="text-2xl font-bold">Import Pipeline</h2>
      )}

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Document type</Label>
              <Select value={docType} onValueChange={(v: DocType) => setDocType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grn">GRN</SelectItem>
                  <SelectItem value="waybill">Waybill</SelectItem>
                  <SelectItem value="monthly_report">Monthly report</SelectItem>
                  <SelectItem value="stock_card">Stock card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <Select value={source} onValueChange={(v: SourceType) => setSource(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                  <SelectItem value="pdf">Typed PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={downloadTemplate}>Download template</Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById(pipelineFileImport.inputId)?.click()}
            >
              Choose file
            </Button>
            <input {...pipelineFileImport.inputProps} />
            {fileName ? (
              <span className="text-sm text-muted-foreground truncate max-w-[240px]" title={fileName}>
                {fileName}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!rows.length || hasError || createDraft.isPending}
              onClick={() => createDraft.mutate({ source, documentType: docType, fileName, rows })}
            >
              Import as drafts
            </Button>
            <Button variant="outline" onClick={() => location.assign("/app/inventory/import/drafts")}>
              Open drafts inbox
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-2 text-left">Row</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Errors</th>
              <th className="px-2 py-2 text-left">Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowIndex} className={row.status === "error" ? "bg-red-50" : row.status === "warning" ? "bg-amber-50" : "bg-green-50"}>
                <td className="px-2 py-2">{row.rowIndex}</td>
                <td className="px-2 py-2 capitalize">{row.status}</td>
                <td className="px-2 py-2">{(row.errors ?? []).join("; ") || "—"}</td>
                <td className="px-2 py-2 text-xs">{JSON.stringify(row.data)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
