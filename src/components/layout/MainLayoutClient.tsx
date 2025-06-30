'use client';

import { usePathname } from 'next/navigation';
import { SidebarNav } from "@/components/layout/SidebarNav";
import AuthorshipNote from "@/components/layout/AuthorshipNote";
import { PanelLeft } from "lucide-react";
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
      {/* Sidebar and collapse button container */}
      {showSidebar && (
        <div className="relative">
          <div
            className={`transition-all duration-300 min-w-0 overflow-hidden
              ${sidebarOpen ? 'lg:w-60 xl:w-64 2xl:w-80' : 'w-0'}
            `}
          >
            {sidebarOpen && <SidebarNav />}
          </div>
          {/* Collapse/expand button, always visible, flush to sidebar edge */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="absolute top-4 right-[-60px] z-50 rounded-xl shadow-md bg-white border border-ashmocha/20 hover:shadow-xl transition-all p-2 flex items-center justify-center text-ashmocha/70 hover:text-ashmocha"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{ width: '36px', height: '36px' }}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pt-12 px-12 flex flex-col min-h-full">
        <div className="flex flex-col items-start">
          <div className="flex-grow w-full">
            {children}
          </div>
        </div>
        <AuthorshipNote />
      </main>
    </div>
  );
} 