import { useEffect, useRef, useState } from "react";
import { subscribeApiLoading } from "../services/api";

export const GlobalLoader = () => {
  const [apiLoading, setApiLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeApiLoading((isLoading) => {
      setApiLoading(isLoading);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (apiLoading) {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      showTimerRef.current = window.setTimeout(() => {
        setVisible(true);
      }, 120);
      return () => {
        if (showTimerRef.current) {
          window.clearTimeout(showTimerRef.current);
          showTimerRef.current = null;
        }
      };
    }

    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, 180);

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [apiLoading]);

  if (!visible) {
    return null;
  }

  return (
    <div className="global-loader-overlay" aria-hidden="true">
      <div className="global-loader-shell">
        <span className="global-loader-ring global-loader-ring-a" />
        <span className="global-loader-ring global-loader-ring-b" />
        <span className="global-loader-core" />
      </div>
    </div>
  );
};
