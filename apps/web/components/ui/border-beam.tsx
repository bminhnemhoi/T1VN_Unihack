"use client"

/*
 * BorderBeam adapted from Magic UI (https://magicui.design), MIT License, Copyright (c) Magic UI.
 * Rewritten without the `motion` dependency (B6, performance): a conic-gradient wedge rotates with a CSS
 * `rotate` animation (compositor friendly, no layout), is masked to a ring, pauses while off screen and is
 * hidden under prefers-reduced-motion (see .beam-ring in globals.css).
 */

import { memo } from "react"

import { useInView } from "@/lib/useInView"
import { cn } from "@/lib/utils"

interface BorderBeamProps {
  /** Kept for API compatibility with Magic UI; the wedge size follows the card. */
  size?: number
  /** Seconds per full turn. */
  duration?: number
  colorFrom?: string
  colorTo?: string
  borderWidth?: number
  className?: string
}

export const BorderBeam = memo(function BorderBeam({
  duration = 9,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  borderWidth = 1,
  className,
}: BorderBeamProps) {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("beam-ring", className)}
      style={{
        padding: borderWidth,
        ["--beam-1" as string]: colorFrom,
        ["--beam-2" as string]: colorTo,
        ["--beam-d" as string]: `${duration}s`,
        ["--beam-state" as string]: inView ? "running" : "paused",
      }}
    />
  )
})
