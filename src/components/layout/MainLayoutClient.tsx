'use client';

import { usePathname } from 'next/navigation';
import { SidebarNav } from "@/components/layout/SidebarNav";
import AuthorshipNote from "@/components/layout/AuthorshipNote";
import { PanelLeft } from "lucide-react";
import { useState, useEffect } from 'react';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_STORAGE_KEY = 'lastActivityTimestamp';

export default function MainLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showSidebar = pathname !== '/login';
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!showSidebar) {
      return;
    }

    let intervalId: NodeJS.Timeout;

    const handleInactivityCheck = () => {
      const lastActivity = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
      if (lastActivity && Date.now() - parseInt(lastActivity, 10) > INACTIVITY_TIMEOUT_MS) {
        localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
        window.location.reload();
      }
    };

    const resetInactivityTimer = () => {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, Date.now().toString());
    };

    const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });

    intervalId = setInterval(handleInactivityCheck, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleInactivityCheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resetInactivityTimer();

    return () => {
      clearInterval(intervalId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showSidebar]);

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