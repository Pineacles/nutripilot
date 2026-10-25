import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/** A native select drawn like Input: 14px radius, g3 edge, ink focus edge, a chevron on the right. */
function NativeSelect({
  className,
  wrapperClassName,
  children,
  ...props
}: React.ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        data-slot="native-select"
        className={cn(
          "h-11 w-full min-w-0 appearance-none rounded-[14px] border border-g3 bg-transparent pr-9 pl-3.5 text-base text-ink transition-colors duration-[var(--dur-fast)] focus-visible:border-ink focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 md:text-[15px]",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-g4"
        aria-hidden="true"
      />
    </div>
  )
}

export { NativeSelect }
