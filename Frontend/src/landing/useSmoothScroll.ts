import { useEffect } from "react";

/**
 * Eased wheel scrolling for the public/marketing pages.
 *
 * The browser's native mouse-wheel scroll on the landing page steps in coarse
 * jumps that feel abrupt. This intercepts the wheel and glides the page toward
 * the target position with a per-frame lerp, so a scroll feels like it carries
 * momentum rather than snapping.
 *
 * It is deliberately conservative:
 *  - off when the user prefers reduced motion, and on touch-primary devices
 *    (touch scrolling is already smooth — hijacking it would only add lag);
 *  - it never steals the wheel from an inner scrollable element (a menu, a
 *    modal) that can still scroll in that direction;
 *  - it resyncs whenever the page is scrolled by any other means (keyboard,
 *    scrollbar, anchor), so the next wheel starts from the real position.
 *
 * Scoped to the landing layout, so it unmounts (and fully cleans up) the moment
 * the user leaves for the authenticated app.
 */
export const useSmoothScroll = (): void => {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touchPrimary = window.matchMedia("(pointer: coarse)").matches;
    if (reducedMotion || touchPrimary) return;

    let target = window.scrollY;
    let current = window.scrollY;
    let animating = false;
    let frame = 0;

    const maxScroll = (): number =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const step = (): void => {
      const distance = target - current;
      if (Math.abs(distance) < 0.5) {
        current = target;
        window.scrollTo({ top: current, left: 0, behavior: "auto" });
        animating = false;
        return;
      }
      // 0.14 is the sweet spot: smooth glide without feeling floaty or laggy.
      current += distance * 0.14;
      window.scrollTo({ top: current, left: 0, behavior: "auto" });
      frame = window.requestAnimationFrame(step);
    };

    const startAnimating = (): void => {
      if (!animating) {
        animating = true;
        frame = window.requestAnimationFrame(step);
      }
    };

    // Walk up from the wheel target: if an ancestor is itself scrollable and not
    // yet at its edge in the scroll direction, let the browser handle it.
    const innerElementCanScroll = (node: EventTarget | null, deltaY: number): boolean => {
      let element = node instanceof Element ? node : null;
      while (element && element !== document.body && element !== document.documentElement) {
        const overflowY = getComputedStyle(element).overflowY;
        const scrollable =
          (overflowY === "auto" || overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight;
        if (scrollable) {
          const atTop = element.scrollTop <= 0;
          const atBottom =
            element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
          if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
            return true;
          }
        }
        element = element.parentElement;
      }
      return false;
    };

    const onWheel = (event: WheelEvent): void => {
      if (event.ctrlKey || event.defaultPrevented) return; // pinch-zoom, or already handled
      // Wheels report deltas in lines (deltaMode 1) or pixels; normalise to px.
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      if (delta === 0) return;
      if (innerElementCanScroll(event.target, delta)) return;

      event.preventDefault();
      target = Math.min(Math.max(target + delta, 0), maxScroll());
      startAnimating();
    };

    const onScroll = (): void => {
      // Only adopt an external scroll position when we are not driving it.
      if (!animating) {
        target = window.scrollY;
        current = window.scrollY;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
};
