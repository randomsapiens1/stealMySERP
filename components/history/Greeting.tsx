"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting() {
  // Server-rendered/static-prerendered output can't know the visitor's
  // local time, so start with a neutral label and swap in the real
  // time-of-day greeting once mounted in the browser.
  const [label, setLabel] = useState("Welcome back");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel(greetingForHour(new Date().getHours()));
  }, []);

  return (
    <h1 className="text-2xl font-semibold">
      {label} <span aria-hidden>👋</span>
    </h1>
  );
}
