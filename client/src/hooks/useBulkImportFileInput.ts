import { useCallback, useId, useRef } from "react";
import { readFileAsBase64Payload } from "@/lib/bulkImportFromFile";
import { toastError, toFriendlyError } from "@/lib/friendlyError";

type BaseOpts = {
  accept: string;
  disabled?: boolean;
  isPending?: boolean;
  /** Custom handler; receives the friendly message and its support ref. Defaults to an error toast. */
  onError?: (message: string, ref: string) => void;
};

type Base64Mode = BaseOpts & {
  prepareFile: "base64";
  run: (base64Payload: string, file: File) => Promise<void>;
};

type FileOnlyMode = BaseOpts & {
  prepareFile: "none";
  run: (file: File) => Promise<void>;
};

export type UseBulkImportFileInputOptions = Base64Mode | FileOnlyMode;

export function useBulkImportFileInput(options: UseBulkImportFileInputOptions) {
  const { accept, disabled = false, isPending = false } = options;
  const busy = Boolean(disabled || isPending);
  const inputId = useId();

  const optsRef = useRef(options);
  optsRef.current = options;

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      input.value = "";
      const o = optsRef.current;
      if (!file || disabled || isPending) return;
      try {
        if (o.prepareFile === "base64") {
          const payload = await readFileAsBase64Payload(file);
          await o.run(payload, file);
        } else {
          await o.run(file);
        }
      } catch (e) {
        const fallback = "We couldn't import the file. Please try again.";
        if (o.onError) {
          const friendly = toFriendlyError(e, fallback, "bulkImport");
          o.onError(friendly.message, friendly.ref);
        } else {
          toastError(e, fallback);
        }
      }
    },
    [disabled, isPending]
  );

  const inputProps = {
    id: inputId,
    type: "file" as const,
    className: "hidden",
    accept,
    disabled: busy,
    onChange: handleChange,
  };

  return { inputProps, inputId, isBusy: busy };
}
