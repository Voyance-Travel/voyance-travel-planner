import { ReactNode } from 'react';
import TopNav from '@/components/common/TopNav';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Layout for authentication pages
 * Includes TopNav but no footer, clean minimal design
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
