"use client";

import { useScreenSize } from "@/hooks/useScreenSize";
import { useEffect, useState } from "react";

export default function ResponsiveGuard({ children }: { children: React.ReactNode }) {
  const breakpoint = useScreenSize();
  const isLarge = breakpoint === "lg" || breakpoint === "xl" || breakpoint === "2xl";
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  if (!isLarge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="max-w-md mx-auto p-8 rounded-lg shadow-lg border border-roseblush bg-roseblush/10 text-center">
          <h1 className="text-lg font-semibold mb-4 text-charcoalcocoa">This app is optimized for laptop use.</h1>
          <p className="text-charcoalcocoa text-base">Please revisit on a larger screen for the intended experience.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
} 