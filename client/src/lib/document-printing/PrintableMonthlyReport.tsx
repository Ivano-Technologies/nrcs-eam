import { PrintableShell } from "./PrintableShell";

type PrintableMonthlyReportProps = {
  rows: any[];
  warehouseName?: string;
  month: number;
  year: number;
};

export function PrintableMonthlyReport({ rows, warehouseName, month, year }: PrintableMonthlyReportProps) {
  return (
    <PrintableShell title="WAREHOUSE - MONTHLY REPORT" subtitle="Rapport Mensuel Entrepot / Monthly Report">
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div><strong>Warehouse (Entrepot):</strong> {warehouseName ?? "—"}</div>
        <div><strong>MONTH (MOIS):</strong> {String(month).padStart(2, "0")}/{year}</div>
      </div>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="border border-black px-1 py-1">SN</th>
            <th className="border border-black px-1 py-1 text-left">Product</th>
            <th className="border border-black px-1 py-1 text-left">Unit & weight</th>
            <th className="border border-black px-1 py-1">Opening Balance (a)</th>
            <th className="border border-black px-1 py-1">IN (b)</th>
            <th className="border border-black px-1 py-1">OUT Distributions (c)</th>
            <th className="border border-black px-1 py-1">OUT Branches (d)</th>
            <th className="border border-black px-1 py-1">OUT Others (e)</th>
            <th className="border border-black px-1 py-1">Loss/Damaged (f)</th>
            <th className="border border-black px-1 py-1">Closing Balance a+b-(c+d+e+f)</th>
            <th className="border border-black px-1 py-1 text-left">Comments</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sn}>
              <td className="border border-black px-1 py-1">{row.sn}</td>
              <td className="border border-black px-1 py-1">{row.product}</td>
              <td className="border border-black px-1 py-1">{row.unitAndWeight}</td>
              <td className="border border-black px-1 py-1">{row.openingBalance}</td>
              <td className="border border-black px-1 py-1">{row.inbound}</td>
              <td className="border border-black px-1 py-1">{row.outDistributions}</td>
              <td className="border border-black px-1 py-1">{row.outBranches}</td>
              <td className="border border-black px-1 py-1">{row.outOthers}</td>
              <td className="border border-black px-1 py-1">{row.lossAndDamaged}</td>
              <td className="border border-black px-1 py-1">{row.closingBalance}</td>
              <td className="border border-black px-1 py-1">{row.comments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableShell>
  );
}
