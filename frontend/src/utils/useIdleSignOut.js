import { useEffect, useRef } from "react";

export const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"];

/**
 * Calls onIdle after the person has done nothing for a while, so a computer
 * left open does not stay signed in. Any click, key press or scroll starts
 * the wait again.
 */
export function useIdleSignOut(onIdle, limit = IDLE_LIMIT_MS) {
  const callback = useRef(onIdle);
  useEffect(() => { callback.current = onIdle; }, [onIdle]);

  useEffect(() => {
    let timer;
    function restart() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback.current?.(), limit);
    }
    restart();
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, restart, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, restart));
    };
  }, [limit]);
}
