import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appPath } from "@/lib/routes";
import { trpc } from "@/lib/trpc";
import { formatNaira } from "@/lib/format";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

function priorityClass(priority: "High" | "Medium" | "Low") {
  if (priority === "High") return "bg-red-100 text-red-700 border-red-200";
  if (priority === "Medium") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
}

export function RequisitionsTable() {
  const { data } = trpc.dashboard.pendingRequisitions.useQuery({ limit: 4 });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Pending requisitions</CardTitle>
        <Link href={appPath("/inventory/requisitions")}>
          <Button className="bg-[#DC2626] hover:bg-[#B91C1C]">Go to queue</Button>
        </Link>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-[#DC2626]">{row.id}</TableCell>
                <TableCell>{row.from}</TableCell>
                <TableCell className="font-semibold">{formatNaira(row.amount)}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell>{row.submittedAt}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={priorityClass(row.priority)}>
                    {row.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
