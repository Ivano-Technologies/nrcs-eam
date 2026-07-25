/**
 * Client-side image resize/re-encode for field uploads.
 * Canvas re-encode drops EXIF (including GPS) — intentional privacy default.
 */
export async function compressImageForUpload(
  file: File,
  options?: { maxLongEdge?: number; quality?: number },
): Promise<{ dataUrl: string; mimeType: "image/jpeg"; byteLength: number }> {
  const maxLongEdge = options?.maxLongEdge ?? 1600;
  const quality = options?.quality ?? 0.8;

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxLongEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not create canvas context for image compression");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const comma = dataUrl.indexOf(",");
    const b64 = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
    const byteLength = Math.floor((b64.length * 3) / 4);

    return { dataUrl, mimeType: "image/jpeg", byteLength };
  } finally {
    bitmap.close();
  }
}
