import QRCode from 'qrcode';

/**
 * Generate QR code as data URL for an asset
 * @param assetId - The asset ID
 * @param assetTag - The asset tag for the QR code content
 * @returns Promise<string> - Base64 data URL of the QR code
 */
export async function generateAssetQRCode(assetId: number, assetTag: string): Promise<string> {
  // Create URL that links to asset detail page
  const baseUrl = process.env.VITE_APP_URL || 'https://your-app-url.com';
  const assetUrl = `${baseUrl}/assets/${assetId}`;
  
  // Generate QR code with asset information
  const qrData = JSON.stringify({
    assetId,
    assetTag,
    url: assetUrl,
    type: 'NRCS_ASSET',
  });
  
  try {
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code as buffer for printing
 * @param assetId - The asset ID
 * @param assetTag - The asset tag
 * @returns Promise<Buffer> - PNG buffer of the QR code
 */
export async function generateAssetQRCodeBuffer(assetId: number, assetTag: string): Promise<Buffer> {
  const baseUrl = process.env.VITE_APP_URL || 'https://your-app-url.com';
  const assetUrl = `${baseUrl}/assets/${assetId}`;
  
  const qrData = JSON.stringify({
    assetId,
    assetTag,
    url: assetUrl,
    type: 'NRCS_ASSET',
  });
  
  try {
    const buffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    
    return buffer;
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw new Error('Failed to generate QR code buffer');
  }
}

/**
 * Parse QR code data to extract asset information
 * @param qrData - The scanned QR code data string
 * @returns Object with asset information or null if invalid
 */
export function parseAssetQRCode(qrData: string): { assetId: number; assetTag: string; url: string } | null {
  try {
    const parsed = JSON.parse(qrData);
    
    if (parsed.type === 'NRCS_ASSET' && parsed.assetId && parsed.assetTag) {
      return {
        assetId: parsed.assetId,
        assetTag: parsed.assetTag,
        url: parsed.url,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing QR code data:', error);
    return null;
  }
}

/**
 * Generate bulk QR code labels PDF for printing
 * @param assets - Array of assets with id, assetTag, and name
 * @param labelSize - Label size template (avery_5160, avery_5163, custom)
 * @returns Promise<Buffer> - PDF buffer with QR code labels
 */
export async function generateBulkQRCodeLabels(
  assets: Array<{ id: number; assetTag: string; name: string; categoryName?: string }>,
  labelSize: 'avery_5160' | 'avery_5163' | 'custom' = 'avery_5160'
): Promise<Buffer> {
  let PDFDocument: any;
  try {
    PDFDocument = (await import('pdfkit')).default;
  } catch (e) {
    throw new Error('PDF generation not available in this environment');
  }
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Label dimensions in points (1 inch = 72 points)
    const labelConfigs = {
      avery_5160: {
        // 1" x 2-5/8" labels, 3 columns x 10 rows
        width: 189, // 2.625 inches
        height: 72, // 1 inch
        marginLeft: 13.5, // 0.1875 inches
        marginTop: 36, // 0.5 inches
        columns: 3,
        rows: 10,
        horizontalGap: 13.5,
        verticalGap: 0,
      },
      avery_5163: {
        // 2" x 4" labels, 2 columns x 5 rows
        width: 288, // 4 inches
        height: 144, // 2 inches
        marginLeft: 12,
        marginTop: 36,
        columns: 2,
        rows: 5,
        horizontalGap: 12,
        verticalGap: 0,
      },
      custom: {
        // Custom 2" x 3" labels
        width: 216,
        height: 144,
        marginLeft: 36,
        marginTop: 36,
        columns: 2,
        rows: 4,
        horizontalGap: 36,
        verticalGap: 36,
      },
    };

    const config = labelConfigs[labelSize];
    let assetIndex = 0;

    const generatePage = async () => {
      for (let row = 0; row < config.rows; row++) {
        for (let col = 0; col < config.columns; col++) {
          if (assetIndex >= assets.length) return;

          const asset = assets[assetIndex];
          const x = config.marginLeft + col * (config.width + config.horizontalGap);
          const y = config.marginTop + row * (config.height + config.verticalGap);

          // Generate QR code
          const qrBuffer = await generateAssetQRCodeBuffer(asset.id, asset.assetTag);

          // Calculate QR code size (60% of label height)
          const qrSize = config.height * 0.6;
          const qrX = x + (config.width - qrSize) / 2;
          const qrY = y + 5;

          // Draw QR code
          doc.image(qrBuffer, qrX, qrY, {
            width: qrSize,
            height: qrSize,
          });

          // Draw asset tag below QR code
          const textY = qrY + qrSize + 3;
          doc
            .fontSize(8)
            .font('Helvetica-Bold')
            .fillColor('#000000')
            .text(asset.assetTag, x, textY, {
              width: config.width,
              align: 'center',
            });

          // Draw asset name
          doc
            .fontSize(6)
            .font('Helvetica')
            .text(asset.name, x, textY + 10, {
              width: config.width,
              align: 'center',
              ellipsis: true,
            });

          // Draw category if available
          if (asset.categoryName) {
            doc
              .fontSize(5)
              .fillColor('#666666')
              .text(asset.categoryName, x, textY + 18, {
                width: config.width,
                align: 'center',
                ellipsis: true,
              });
          }

          assetIndex++;
        }
      }
    };

    // Generate all pages
    (async () => {
      try {
        while (assetIndex < assets.length) {
          await generatePage();
          if (assetIndex < assets.length) {
            doc.addPage();
          }
        }
        doc.end();
      } catch (error) {
        reject(error);
      }
    })();
  });
}
