"use client";

import { useRef, useEffect, useCallback } from "react";
import { animate, stagger } from "animejs";
import { SPRING_GENTLE, STAGGER_GRID, DURATION_NORMAL } from "./config";

interface UseEntranceOptions {
  /** Pixels to translate from on Y axis (default: 16) */
  translateY?: number;
  /** Pixels to translate from on X axis (default: 0) */
  translateX?: number;
  /** Scale range [from, to] (default: [1, 1] — no scale) */
  scale?: [number, number];
  /** Opacity range [from, to] (default: [0, 1]) */
  opacity?: [number, number];
  /** Child selector for stagger targets. If omitted, animates the container itself */
  selector?: string;
  /** Stagger delay in ms between children (default: 40) */
  staggerDelay?: number;
  /** Easing string (default: SPRING_GENTLE) */
  ease?: string;
  /** Duration in ms (default: 500) */
  duration?: number;
  /** IntersectionObserver threshold (default: 0.1) */
  threshold?: number;
  /** IntersectionObserver rootMargin (default: "0px 0px -40px 0px") */
  rootMargin?: string;
  /** Whether animation is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook that triggers an anime.js entrance animation when an element
 * enters the viewport via IntersectionObserver.
 *
 * Returns a ref to attach to the container element.
 * Respects prefers-reduced-motion.
 */
export function useEntrance<T extends HTMLElement = HTMLDivElement>(
  options: UseEntranceOptions = {}
) {
  const {
    translateY = 16,
    translateX = 0,
    scale,
    opacity = [0, 1],
    selector,
    staggerDelay = STAGGER_GRID,
    ease = SPRING_GENTLE,
    duration = DURATION_NORMAL,
    threshold = 0.1,
    rootMargin = "0px 0px -40px 0px",
    enabled = true,
  } = options;

  const ref = useRef<T>(null);
  const hasAnimated = useRef(false);

  const runAnimation = useCallback(
    (el: T) => {
      // Check reduced motion preference
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const targets = selector ? el.querySelectorAll(selector) : el;

      if (reducedMotion || !enabled) {
        // Immediately show elements without animation
        const elements = selector
          ? Array.from(el.querySelectorAll(selector))
          : [el];
        elements.forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.opacity = String(opacity[1]);
            element.style.transform = "none";
          }
        });
        return;
      }

      // Build animation properties dynamically
      // Note: anime.js v4's array syntax [from, to] handles setting the initial
      // state internally.  We no longer set it manually so that elements stay
      // visible when animate is mocked (e.g. in tests).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const animParams: any = {
        opacity: [opacity[0], opacity[1]],
        ease,
        duration,
      };

      if (translateY) {
        animParams.translateY = [translateY, 0];
      }
      if (translateX) {
        animParams.translateX = [translateX, 0];
      }
      if (scale) {
        animParams.scale = [scale[0], scale[1]];
      }
      if (selector) {
        animParams.delay = stagger(staggerDelay);
      }

      animate(targets, animParams);
    },
    [translateY, translateX, scale, opacity, selector, staggerDelay, ease, duration, enabled]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || hasAnimated.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            runAnimation(el);
            observer.disconnect();
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [runAnimation, threshold, rootMargin]);

  return ref;
}
