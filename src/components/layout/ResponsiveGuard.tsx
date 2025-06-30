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
          <h1 className="text-base font-semibold mb-4 text-charcoalcocoa">You found the tiny-screen trapdoor!</h1>
          <p className="text-charcoalcocoa text-sm">Ibuilt this just for laptops -- come back with a bigger screen and I'll show you around. (๑˃̵ᴗ˂̵)</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
} 