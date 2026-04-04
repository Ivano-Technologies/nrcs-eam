let PDFDocument: any = null;
try {
  PDFDocument = require('pdfkit');
} catch (e) {
  console.warn('PDFKit not available - PDF generation disabled');
}

import ExcelJS from 'exceljs';
import { Readable } from 'stream';

// PDF Report Generator
export async function generatePDFReport(
  title: string,
  data: any[],
  columns: { header: string; key: string; width?: number }[],
  options?: {
    subtitle?: string;
    footer?: string;
    includeCharts?: boolean;
  }
): Promise<Buffer> {
  if (!PDFDocument) {
    throw new Error('PDF generation not available in this environment');
  }
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header with NRCS branding
    doc
      .fontSize(20)
      .fillColor('#1e3a8a')
      .text('Nigerian Red Cross Society', { align: 'center' })
      .fontSize(16)
      .fillColor('#dc2626')
      .text('Enterprise Asset Management', { align: 'center' })
      .moveDown();

    // Report title
    doc
      .fontSize(14)
      .fillColor('#000000')
      .text(title, { align: 'center', underline: true })
      .moveDown();

    if (options?.subtitle) {
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text(options.subtitle, { align: 'center' })
        .moveDown();
    }

    // Generation date
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' })
      .moveDown(2);

    // Table header
    const tableTop = doc.y;
    const columnWidth = (doc.page.width - 100) / columns.length;
    let xPos = 50;

    doc.fontSize(10).fillColor('#1e3a8a');
    columns.forEach((col) => {
      doc.text(col.header, xPos, tableTop, {
        width: col.width || columnWidth,
        align: 'left',
      });
      xPos += col.width || columnWidth;
    });

    // Draw line under header
    doc
      .moveTo(50, tableTop + 15)
      .lineTo(doc.page.width - 50, tableTop + 15)
      .stroke('#dc2626');

    // Table rows
    let yPos = tableTop + 25;
    doc.fontSize(9).fillColor('#000000');

    data.forEach((row, index) => {
      // Check if we need a new page
      if (yPos > doc.page.height - 100) {
        doc.addPage();
        yPos = 50;
      }

      xPos = 50;
      columns.forEach((col) => {
        const value = row[col.key] !== undefined && row[col.key] !== null 
          ? String(row[col.key]) 
          : '-';
        doc.text(value, xPos, yPos, {
          width: col.width || columnWidth,
          align: 'left',
          ellipsis: true,
        });
        xPos += col.width || columnWidth;
      });

      yPos += 20;

      // Alternate row background (subtle)
      if (index % 2 === 0) {
        doc
          .rect(50, yPos - 18, doc.page.width - 100, 18)
          .fillOpacity(0.05)
          .fill('#1e3a8a')
          .fillOpacity(1);
      }
    });

    // Footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#666666')
        .text(
          options?.footer || 'NRCS EAM System - Confidential',
          50,
          doc.page.height - 50,
          { align: 'center' }
        )
        .text(
          `Page ${i + 1} of ${pageCount}`,
          50,
          doc.page.height - 35,
          { align: 'center' }
        );
    }

    doc.end();
  });
}

// Excel Report Generator
export async function generateExcelReport(
  title: string,
  data: any[],
  columns: { header: string; key: string; width?: number }[],
  options?: {
    sheetName?: string;
    includeFormulas?: boolean;
  }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NRCS EAM System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(options?.sheetName || 'Report');

  // Add title row
  worksheet.mergeCells('A1', `${String.fromCharCode(64 + columns.length)}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1e3a8a' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 30;

  // Add generation date
  worksheet.mergeCells('A2', `${String.fromCharCode(64 + columns.length)}2`);
  const dateCell = worksheet.getCell('A2');
  dateCell.value = `Generated: ${new Date().toLocaleString()}`;
  dateCell.font = { size: 10, color: { argb: 'FF666666' } };
  dateCell.alignment = { horizontal: 'center' };
  worksheet.getRow(2).height = 20;

  // Add empty row
  worksheet.addRow([]);

  // Add header row
  const headerRow = worksheet.addRow(columns.map((col) => col.header));
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1e3a8a' },
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 25;

  // Set column widths
  columns.forEach((col, index) => {
    worksheet.getColumn(index + 1).width = col.width || 15;
  });

  // Add data rows
  data.forEach((row) => {
    const rowData = columns.map((col) => {
      const value = row[col.key];
      // Handle different data types
      if (value === null || value === undefined) return '-';
      if (value instanceof Date) return value.toLocaleDateString();
      if (typeof value === 'number') return value;
      return String(value);
    });
    const dataRow = worksheet.addRow(rowData);
    dataRow.alignment = { vertical: 'middle' };
  });

  // Add borders to all cells
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 3) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFcccccc' } },
          left: { style: 'thin', color: { argb: 'FFcccccc' } },
          bottom: { style: 'thin', color: { argb: 'FFcccccc' } },
          right: { style: 'thin', color: { argb: 'FFcccccc' } },
        };
      });
    }
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Helper function to convert buffer to base64 for download
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}
