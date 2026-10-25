import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[14px] border border-g3 bg-transparent px-3.5 py-1 text-base text-ink transition-colors duration-[var(--dur-fast)] file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-g4 focus-visible:border-ink focus-visible:outline-hidden disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-g2 disabled:text-g4 aria-invalid:border-ink aria-invalid:border-dashed md:text-[15px]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
