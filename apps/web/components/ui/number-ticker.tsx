"use client"

/*
 * NumberTicker adapted from Magic UI (https://magicui.design), MIT License,
 * Copyright (c) Magic UI. Rewritten without the `motion` dependency (B6, performance):
 * - counts up ONCE, the first time it scrolls into view; later `value` changes (a slider, typing) show at once;
 * - vi-VN number format; respects prefers-reduced-motion; keeps a screen-reader copy of the final value;
 * - reserves the width of the final value so the count-up never shifts the layout.
 */

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react"

import { usePrefersReducedMotion } from "@/lib/useInView"
import { cn } from "@/lib/utils"

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number
  startValue?: number
  /** Seconds before the first count-up starts. */
  delay?: number
  decimalPlaces?: number
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export function NumberTicker({ value, startValue = 0, delay = 0, className, decimalPlaces = 0, ...props }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState<number | null>(null) // non-null only while counting
  const played = useRef(false)
  const valueRef = useRef(value)
  const reduce = usePrefersReducedMotion()
  const fmt = (n: number) =>
    Intl.NumberFormat("vi-VN", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(n)

  // A new value while counting (user dragged the slider): stop counting and show the real value.
  useEffect(() => {
    valueRef.current = value
    setShown((s) => (s === null ? s : null))
  }, [value])

  useEffect(() => {
    const el = ref.current
    if (!el || reduce || played.current || typeof IntersectionObserver === "undefined") return
    let raf = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || played.current) return
      played.current = true
      io.disconnect()
      timer = setTimeout(() => {
        const to = valueRef.current
        const t0 = performance.now()
        const step = (now: number) => {
          const t = Math.min(1, (now - t0) / 700)
          setShown(t < 1 ? startValue + (to - startValue) * easeOut(t) : null)
          if (t < 1) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
      }, delay * 1000)
    })
    io.observe(el)
    return () => {
      io.disconnect()
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [reduce, delay, startValue])

  const finalText = fmt(value)
  return (
    <>
      <span className="sr-only">{finalText}</span>
      <span ref={ref} aria-hidden="true" className={cn("inline-grid tabular-nums", className)} {...props}>
        <span className="invisible col-start-1 row-start-1">{finalText}</span>
        <span className="col-start-1 row-start-1 justify-self-end">{shown === null ? finalText : fmt(Number(shown.toFixed(decimalPlaces)))}</span>
      </span>
    </>
  )
}
