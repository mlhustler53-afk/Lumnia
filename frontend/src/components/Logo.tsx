import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showGlow?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
};

export function Logo({ className, size = "md", showGlow = false }: LogoProps) {
  return (
    <div className={cn("relative shrink-0", className)}>
      {showGlow && (
        <div
          className={cn(
            "absolute inset-0 rounded-2xl bg-violet-500/30 blur-xl",
            sizeClasses[size]
          )}
        />
      )}
      <img
        src="/logo.png"
        alt="Lumina Music"
        className={cn("relative rounded-2xl object-cover shadow-lg", sizeClasses[size])}
      />
    </div>
  );
}
