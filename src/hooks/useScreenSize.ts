import { useEffect, useState } from "react";

// Returns the current Tailwind breakpoint as a string: 'base', 'lg', 'xl', or '2xl'
export function useScreenSize() {
  const getBreakpoint = () => {
    if (typeof window === "undefined") return 'lg'; // Assume lg on SSR
    const width = window.innerWidth;
    if (width >= 1536) return '2xl';
    if (width >= 1280) return 'xl';
    if (width >= 1024) return 'lg';
    return 'base';
  };

  const [breakpoint, setBreakpoint] = useState<string>(getBreakpoint);

  useEffect(() => {
    const handler = () => setBreakpoint(getBreakpoint());
    window.addEventListener("resize", handler);
    handler();
    return () => window.removeEventListener("resize", handler);
  }, []);

  return breakpoint;
} 