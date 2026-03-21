"use client";

import { useRef, useEffect, type RefObject } from "react";
import { animate, stagger } from "animejs";
import { SPRING_SNAPPY } from "./config";

interface UseListAnimationOptions {
  /** CSS properties for new items entering */
  enterFrom?: Record<string, number | string>;
  /** CSS properties for items exiting */
  exitTo?: Record<string, number | string>;
  /** Stagger delay between items in ms (default: 0) */
  staggerDelay?: number;
  /** Easing (default: SPRING_SNAPPY) */
  ease?: string;
  /** Duration in ms (default: 300) */
  duration?: number;
  /** Selector for list items. If omitted, uses direct children. */
  itemSelector?: string;
}

/**
 * Hook that animates new items entering a list container.
 * Tracks the number of children and animates new ones.
 */
export function useListAnimation<T extends HTMLElement = HTMLDivElement>(
  containerRef: RefObject<T | null>,
  options: UseListAnimationOptions = {}
) {
  const {
    enterFrom = { opacity: 0, translateX: 20 },
    staggerDelay = 0,
    ease = SPRING_SNAPPY,
    duration = 300,
    itemSelector,
  } = options;

  const prevCountRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) return;

    const items = itemSelector
      ? container.querySelectorAll(itemSelector)
      : container.children;
    const currentCount = items.length;
    const prevCount = prevCountRef.current;

    if (currentCount > prevCount && prevCount > 0) {
      // New items added — animate them in
      const newItems = Array.from(items).slice(prevCount);

      // Set initial state
      newItems.forEach((item) => {
        if (item instanceof HTMLElement) {
          Object.entries(enterFrom).forEach(([key, value]) => {
            if (key === "opacity") {
              item.style.opacity = String(value);
            } else if (key === "translateX" || key === "translateY") {
              item.style.transform = `${key.replace("translate", "translate")}(${value}px)`;
            }
          });
        }
      });

      // Build animation params (animate to normal state)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const animParams: any = {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        ease,
        duration,
      };

      if (staggerDelay > 0) {
        animParams.delay = stagger(staggerDelay);
      }

      animate(newItems, animParams);
    }

    prevCountRef.current = currentCount;
  });
}
