"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Reveals `[data-reveal]` elements as they scroll into view.
 *
 * Render this *inside* each page segment, never in the root layout. React
 * hydrates the layout before a suspended page boundary, so a layout-level
 * effect would rewrite `className` on DOM the boundary hasn't hydrated yet —
 * which React then reports as a hydration mismatch.
 */
export function MotionObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    nodes.forEach((node) => {
      node.classList.remove("motion-pending", "is-revealed");
      const rect = node.getBoundingClientRect();
      const alreadyVisible = rect.top < window.innerHeight * 0.88 && rect.bottom > 0;

      if (alreadyVisible) {
        node.classList.add("is-revealed");
      } else {
        node.classList.add("motion-pending");
        observer.observe(node);
      }
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
