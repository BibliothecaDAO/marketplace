"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { animate } from "animejs";
import { SPRING_SNAPPY, DURATION_FAST } from "./config";

interface UseAnimatedNumberOptions {
  /** Easing string (default: SPRING_SNAPPY) */
  ease?: string;
  /** Duration in ms (default: 300) */
  duration?: number;
  /** Format function (default: toString) */
  format?: (n: number) => string;
  /** Decimal places for rounding during animation (default: 2) */
  decimals?: number;
}

/**
 * Hook that animates a number value with spring easing.
 * Returns the current displayed string value.
 */
export function useAnimatedNumber(
  target: number,
  options: UseAnimatedNumberOptions = {}
): string {
  const {
    ease = SPRING_SNAPPY,
    duration = DURATION_FAST,
    format,
    decimals = 2,
  } = options;

  const [displayValue, setDisplayValue] = useState(target);
  const objRef = useRef({ val: target });
  const prevTargetRef = useRef(target);

  const onAnimationUpdate = useCallback(() => {
    setDisplayValue(objRef.current.val);
  }, []);

  useEffect(() => {
    if (prevTargetRef.current === target) return;
    prevTargetRef.current = target;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion) {
      objRef.current.val = target;
      // Schedule state update for next tick to avoid sync setState in effect
      queueMicrotask(() => setDisplayValue(target));
      return;
    }

    animate(objRef.current, {
      val: target,
      ease,
      duration,
      onUpdate: onAnimationUpdate,
    });
  }, [target, ease, duration, onAnimationUpdate]);

  if (format) {
    return format(displayValue);
  }

  return Number(displayValue).toFixed(decimals);
}
