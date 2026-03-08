import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  /**
   * Allows native date/time controls on mobile Safari.
   * Default is false so we avoid blocky iOS date/time fields.
   */
  allowNativeMobileDateTime?: boolean;
};

const MOBILE_BREAKPOINT = 768;

function shouldUsePlainTextDateTime(type?: string, allowNativeMobileDateTime?: boolean): boolean {
  if (allowNativeMobileDateTime) return false;
  if (type !== "date" && type !== "time") return false;
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isMobileViewport = window.innerWidth < MOBILE_BREAKPOINT;

  return isIOS && isSafari && isMobileViewport;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, allowNativeMobileDateTime = false, inputMode, placeholder, pattern, title, ...props }, ref) => {
    const [usePlainTextDateTime, setUsePlainTextDateTime] = React.useState(() =>
      shouldUsePlainTextDateTime(type, allowNativeMobileDateTime),
    );

    React.useEffect(() => {
      if (typeof window === "undefined") return;

      const updateMode = () => {
        setUsePlainTextDateTime(shouldUsePlainTextDateTime(type, allowNativeMobileDateTime));
      };

      updateMode();
      window.addEventListener("resize", updateMode);

      return () => window.removeEventListener("resize", updateMode);
    }, [type, allowNativeMobileDateTime]);

    const isDateOrTime = type === "date" || type === "time";
    const effectiveType = usePlainTextDateTime ? "text" : type;
    const effectivePlaceholder = placeholder ?? (usePlainTextDateTime
      ? type === "date"
        ? "YYYY-MM-DD"
        : "HH:MM"
      : undefined);
    const effectivePattern = pattern ?? (usePlainTextDateTime
      ? type === "date"
        ? "\\d{4}-\\d{2}-\\d{2}"
        : "([01]\\d|2[0-3]):([0-5]\\d)"
      : undefined);
    const effectiveTitle = title ?? (usePlainTextDateTime
      ? type === "date"
        ? "Use YYYY-MM-DD"
        : "Use HH:MM in 24-hour format"
      : undefined);

    return (
      <input
        type={effectiveType}
        inputMode={usePlainTextDateTime ? (type === "date" ? "numeric" : "decimal") : inputMode}
        placeholder={effectivePlaceholder}
        pattern={effectivePattern}
        title={effectiveTitle}
        data-mobile-plain-datetime={usePlainTextDateTime && isDateOrTime ? "true" : undefined}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          usePlainTextDateTime && isDateOrTime && "[font-variant-numeric:tabular-nums] tracking-wide",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
