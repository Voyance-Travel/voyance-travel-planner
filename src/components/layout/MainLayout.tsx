import { ReactNode } from 'react';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';

interface MainLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
  className?: string;
}

/**
 * Main layout wrapper with TopNav and optional Footer
 * Use for public pages that need the full navigation experience
 */
export default function MainLayout({
  children,
  showFooter = true,
  className = '',
}: MainLayoutProps) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      <TopNav />
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
