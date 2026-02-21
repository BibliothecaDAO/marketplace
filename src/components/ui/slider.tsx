"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      data-slot="slider"
      {...props}
    >
      <SliderPrimitive.Track
        className="bg-muted relative h-1.5 grow overflow-hidden rounded-full"
        data-slot="slider-track"
      >
        <SliderPrimitive.Range
          className="bg-primary absolute h-full"
          data-slot="slider-range"
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="border-primary bg-background ring-ring/50 block size-4 rounded-full border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
        data-slot="slider-thumb"
      />
    </SliderPrimitive.Root>
  )
}

export { Slider }
