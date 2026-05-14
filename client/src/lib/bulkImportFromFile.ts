/**
 * Base64 payload suitable for `Buffer.from(b64)` on the server (same as Facilities import).
 * Uses a data URL read so behaviour matches legacy `FileReader.readAsDataURL` + split.
 */
export function readFileAsBase64Payload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(reader.error?.message ?? "Failed to read file"));
    reader.onload = () => {
      const data = String(reader.result ?? "");
      const comma = data.indexOf(",");
      resolve(comma >= 0 ? data.slice(comma + 1) : data);
    };
    reader.readAsDataURL(file);
  });
}
