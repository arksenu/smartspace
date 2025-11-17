import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-2xl border border-white/5 bg-[#1A1A1D] px-4 py-2 text-base text-[#CFCFD3] transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#CFCFD3] placeholder:text-[#8C8C92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F12] focus-visible:border-white/10 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
