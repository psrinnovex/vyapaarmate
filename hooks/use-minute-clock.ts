"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
};
const getSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;
const getServerSnapshot = () => 0;

/** Current time rounded to the minute; 0 during server render. Re-renders once a minute. */
export function useMinuteClock() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
