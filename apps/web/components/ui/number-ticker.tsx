"use client"

/*
 * NumberTicker adapted from Magic UI (https://magicui.design), MIT License,
 * Copyright (c) Magic UI. Changes: vi-VN number format, inherits text colour, respects
 * prefers-reduced-motion, keeps a screen-reader copy of the final value.
 */

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react"
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react"

import { cn } from "@/lib/utils"

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number
  startValue?: number
  direction?: "up" | "down"
  delay?: number
  decimalPlaces?: number
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const fmt = (n: number) =>
    Intl.NumberFormat("vi-VN", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(n)
  const motionValue = useMotionValue(value)
  const played = useRef(false)
  const springValue = useSpring(motionValue, {
    damping: 32,
    stiffness: 140,
  })
  const isInView = useInView(ref, { once: true, margin: "0px" })
  const reduce = useReducedMotion()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (isInView) {
      if (!played.current && !reduce) {
        // First time on screen: jump back to the start so the count-up is visible, then run to `value`.
        played.current = true
        springValue.jump(direction === "down" ? value : startValue)
        motionValue.jump(direction === "down" ? value : startValue)
        if (ref.current) ref.current.textContent = fmt(direction === "down" ? value : startValue)
      }
      timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value)
      }, delay * 1000)
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
  }, [motionValue, springValue, isInView, delay, value, direction, startValue, reduce, decimalPlaces])

  useEffect(() => {
    if (reduce && ref.current) {
      ref.current.textContent = Intl.NumberFormat("vi-VN", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(value)
    }
  }, [reduce, value, decimalPlaces])

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (reduce) return
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("vi-VN", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)))
        }
      }),
    [springValue, decimalPlaces, reduce]
  )

  const finalText = Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value)
  return (
    <>
    <span className="sr-only">{finalText}</span>
    <span
      aria-hidden="true"
      ref={ref}
      className={cn(
        "inline-block tabular-nums",
        className
      )}
      {...props}
    >
      {finalText}
    </span>
    </>
  )
}
