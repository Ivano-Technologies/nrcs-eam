import JsBarcode from 'jsbarcode';

let createCanvas: any = null;
try {
  createCanvas = require('canvas').createCanvas;
} catch (e) {
  console.warn('Canvas not available - barcode generation disabled');
}

/**
 * Generate barcode image for an asset
 * Supports Code128, Code39, EAN13 formats
 */
export function generateBarcode(
  value: string,
  format: 'CODE128' | 'CODE39' | 'EAN13' = 'CODE128'
): string {
  if (!createCanvas) {
    throw new Error('Barcode generation not available in this environment');
  }
  
  const canvas = createCanvas(200, 100);
  
  try {
    JsBarcode(canvas, value, {
      format: format,
      width: 2,
      height: 80,
      displayValue: true,
      fontSize: 14,
      margin: 10,
    });
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    throw new Error(`Failed to generate barcode: ${error}`);
  }
}

/**
 * Validate barcode format and value
 */
export function validateBarcode(value: string, format: string): boolean {
  switch (format) {
    case 'CODE128':
      // CODE128 can encode any ASCII character
      return value.length > 0 && value.length <= 80;
    
    case 'CODE39':
      // CODE39 supports alphanumeric and some special characters
      return /^[0-9A-Z\-\.\ \$\/\+\%]+$/.test(value) && value.length > 0;
    
    case 'EAN13':
      // EAN13 requires exactly 13 digits
      return /^\d{13}$/.test(value);
    
    default:
      return false;
  }
}

/**
 * Generate unique barcode value for asset
 */
export function generateBarcodeValue(assetTag: string, format: 'CODE128' | 'CODE39' | 'EAN13'): string {
  switch (format) {
    case 'CODE128':
      return `NRCS-${assetTag}`;
    
    case 'CODE39':
      // CODE39 doesn't support lowercase, convert to uppercase
      return `NRCS${assetTag.toUpperCase().replace(/[^0-9A-Z]/g, '')}`;
    
    case 'EAN13':
      // Generate a 13-digit EAN from asset tag
      // First 3 digits: country code (616 for Nigeria)
      // Next 9 digits: from asset tag hash
      // Last digit: checksum
      const numericPart = assetTag.replace(/\D/g, '').padStart(9, '0').slice(0, 9);
      const ean12 = `616${numericPart}`;
      const checksum = calculateEAN13Checksum(ean12);
      return `${ean12}${checksum}`;
    
    default:
      return assetTag;
  }
}

/**
 * Calculate EAN13 checksum digit
 */
function calculateEAN13Checksum(ean12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(ean12[i] || '0');
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}
