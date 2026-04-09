import { cn } from "@/lib/utils";

interface AuthPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthPageLayout({ children, className }: AuthPageLayoutProps) {
  return (
    <div
      className={cn(
        "min-h-screen w-full flex items-center justify-center p-4",
        "bg-gradient-to-br from-red-50 via-white to-red-100",
        className
      )}
    >
      {children}
    </div>
  );
}
