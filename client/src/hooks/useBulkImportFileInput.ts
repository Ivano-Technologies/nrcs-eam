import { useCallback, useId, useRef } from "react";
import { readFileAsBase64Payload } from "@/lib/bulkImportFromFile";
import { toast } from "sonner";
import { toFriendlyMessage } from "@/lib/friendlyError";

type BaseOpts = {
  accept: string;
  disabled?: boolean;
  isPending?: boolean;
  onError?: (message: string) => void;
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
  const { accept, disabled = false, isPending = false, onError = (msg) => toast.error(msg) } = options;
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
      const err = o.onError ?? ((msg: string) => toast.error(msg));
      try {
        if (o.prepareFile === "base64") {
          const payload = await readFileAsBase64Payload(file);
          await o.run(payload, file);
        } else {
          await o.run(file);
        }
      } catch (e) {
        err(toFriendlyMessage(e, "We couldn't import the file. Please try again."));
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
