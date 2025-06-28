'use client';

import { usePathname } from 'next/navigation';
import { SidebarNav } from "@/components/layout/SidebarNav";
import AuthorshipNote from "@/components/layout/AuthorshipNote";
import { PanelLeft, PanelRight } from "lucide-react";
import { useState } from 'react';

export default function MainLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showSidebar = pathname !== '/login';
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-full">
      {/* Sidebar with transition */}
      {showSidebar && (
        <div
          className="transition-all duration-300 min-w-0 overflow-hidden"
          style={{ width: sidebarOpen ? '19rem' : '0' }}
        >
          {sidebarOpen && <SidebarNav />}
        </div>
      )}
      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pt-4 px-4 flex flex-col min-h-full">
        <div className="flex flex-col items-start">
          {/* Floating collapse/expand button (relative, not absolute) */}
          {showSidebar && (
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="z-50 rounded-lg shadow-md bg-white border border-ashmocha/20 hover:shadow-xl transition-all p-2 flex items-center justify-center text-ashmocha/70 hover:text-ashmocha"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-grow w-full">
            {children}
          </div>
        </div>
        <AuthorshipNote />
      </main>
    </div>
  );
} 