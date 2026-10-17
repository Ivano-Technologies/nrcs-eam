import { UserFacingError } from "@shared/friendlyError";

/**
 * Base64 payload suitable for `Buffer.from(b64)` on the server (same as Facilities import).
 * Uses a data URL read so behaviour matches legacy `FileReader.readAsDataURL` + split.
 */
export function readFileAsBase64Payload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      console.error("[bulkImport] FileReader failed", reader.error);
      reject(new UserFacingError("We couldn't read that file. Please check it and try again."));
    };
    reader.onload = () => {
      const data = String(reader.result ?? "");
      const comma = data.indexOf(",");
      resolve(comma >= 0 ? data.slice(comma + 1) : data);
    };
    reader.readAsDataURL(file);
  });
}
