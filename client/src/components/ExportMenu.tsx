import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDown, Download } from "lucide-react";

export type ExportFormatOption = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
};

type ExportMenuProps = {
  formats: ExportFormatOption[];
  label?: string;
  disabled?: boolean;
  className?: string;
  testId?: string;
};

export function ExportMenu({
  formats,
  label = "Export",
  disabled = false,
  className,
  testId,
}: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(className)}
          data-testid={testId}
        >
          <Download className="mr-2 h-4 w-4" />
          {label}
          <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => (
          <DropdownMenuItem
            key={format.id}
            disabled={format.disabled}
            data-testid={testId ? `${testId}-${format.id}` : undefined}
            onSelect={() => format.onSelect()}
          >
            {format.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
