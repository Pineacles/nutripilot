"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)] select-none active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none motion-reduce:transition-none motion-reduce:active:scale-100 aria-invalid:border-ink [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Ink fill, g0 text: the action.
        default: "bg-ink text-g0 hover:bg-ink/90 [a]:hover:bg-ink/90 disabled:bg-g2 disabled:text-g4",
        // g3 edge on ground: one of several actions.
        outline:
          "border-g3 bg-transparent text-ink hover:border-g5 aria-expanded:border-g5 disabled:border-g2 disabled:text-g3",
        secondary:
          "bg-g2 text-ink hover:bg-g3 aria-expanded:bg-g3 disabled:text-g4",
        // Icon buttons and quiet text actions: fill steps to g2 on hover.
        ghost:
          "text-g5 hover:bg-g2 hover:text-ink aria-expanded:bg-g2 aria-expanded:text-ink disabled:text-g3",
        // Destructive: an outline pill in the attention colour. The word ("Delete") carries the
        // meaning, the colour only warms it. Hover fills a 12% tint of --alert.
        destructive:
          "border-alert bg-transparent text-alert hover:bg-alert/12 disabled:border-g2 disabled:text-g3",
        link: "rounded-none text-ink underline underline-offset-4 hover:text-g5 disabled:text-g3",
      },
      size: {
        default:
          "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-8 gap-1 px-3 text-xs has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 px-4 text-[13px] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-[15px] has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
