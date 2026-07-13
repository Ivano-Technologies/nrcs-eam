import type { ScheduledReport } from "../../drizzle/schema";

export type ScheduledReportAttachment = {
  filename: string;
  mimeType: string;
  contentBase64: string;
};

export async function buildScheduledReportDelivery(report: ScheduledReport): Promise<{
  html: string;
  attachment?: ScheduledReportAttachment;
}> {
  const filters = report.filters ? (JSON.parse(report.filters) as Record<string, unknown>) : {};

  if (report.reportType === "fleetHealth") {
    const { buildFleetHealthSummary } = await import("./fleetHealth");
    const { renderFleetHealthPdf } = await import("./fleetHealthPdf");
    const siteId = typeof filters.siteId === "number" ? filters.siteId : undefined;
    const summary = await buildFleetHealthSummary(siteId != null ? { siteId } : undefined);
    const ow = summary.orgWide;
    let attachment: ScheduledReportAttachment | undefined;
    if (report.format === "pdf") {
      const buffer = await renderFleetHealthPdf(summary);
      attachment = {
        filename: `fleet-health-${summary.reportDate}.pdf`,
        mimeType: "application/pdf",
        contentBase64: buffer.toString("base64"),
      };
    }
    return {
      html: `<p>Fleet health summary for ${summary.reportDate}</p>
<ul>
<li>Total book value: ${ow.totalBookValue.toLocaleString()}</li>
<li>End-of-life pipeline: ${ow.endOfLifeCount} assets</li>
<li>High-priority predictions: ${ow.highPriorityPredictions.length}</li>
<li>Active inventory alerts: ${ow.activeInventoryAlerts}</li>
</ul>
<p>View full report in NRCS EAM → Reports → Fleet health.</p>`,
      attachment,
    };
  }

  if (report.reportType === "donorStatement") {
    const donorId = typeof filters.donorId === "number" ? filters.donorId : null;
    if (donorId == null) {
      return { html: "<p>Donor statement schedule is missing donorId in filters.</p>" };
    }
    const from = typeof filters.from === "string" ? filters.from : undefined;
    const to = typeof filters.to === "string" ? filters.to : undefined;
    const { buildDonorStatement } = await import("./donorStatement");
    const statement = await buildDonorStatement({ donorId, from, to });
    let attachment: ScheduledReportAttachment | undefined;
    if (report.format === "pdf") {
      const { renderDonorStatementPdf } = await import("./donorStatementPdf");
      const buffer = await renderDonorStatementPdf(statement);
      attachment = {
        filename: `donor-statement-${statement.donorCode}-${statement.periodFrom}-${statement.periodTo}.pdf`,
        mimeType: "application/pdf",
        contentBase64: buffer.toString("base64"),
      };
    }
    return {
      html: `<p>Donor accountability statement: <strong>${statement.donorName}</strong></p>
<p>Period: ${statement.periodFrom} — ${statement.periodTo}</p>
<p>Line items: ${statement.lines.length}. Closing balance reconciled: ${statement.reconciled ? "yes" : "review discrepancies in app"}.</p>`,
      attachment,
    };
  }

  if (report.reportType === "branchScorecards") {
    const { buildBranchScorecardList } = await import("./branchScorecards");
    const list = await buildBranchScorecardList();
    const top = list[0];
    const bottom = list[list.length - 1];
    return {
      html: `<p>Branch scorecards — ${list.length} branches ranked.</p>
${top ? `<p>Top: ${top.branchName} (score ${top.compositeScore})</p>` : ""}
${bottom && bottom !== top ? `<p>Needs attention: ${bottom.branchName} (score ${bottom.compositeScore})</p>` : ""}
<p>View details in NRCS EAM → Reports → Branch scorecards.</p>`,
    };
  }

  return {
    html: `<p>Your scheduled <strong>${report.reportType}</strong> report (${report.format}) ran successfully.</p>`,
  };
}
