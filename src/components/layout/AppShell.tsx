'use client';

import { usePathname } from 'next/navigation';
import MainLayoutClient from '@/components/layout/MainLayoutClient';
import ResponsiveGuard from '@/components/layout/ResponsiveGuard';
import React from 'react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <>
      {isLoginPage ? (
        children
      ) : (
        <ResponsiveGuard>
          <MainLayoutClient>{children}</MainLayoutClient>
        </ResponsiveGuard>
      )}
    </>
  );
} 