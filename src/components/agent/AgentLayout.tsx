import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import AgentSidebar from './AgentSidebar';
import AgentBreadcrumb from './AgentBreadcrumb';
import { useAgentAuth } from '@/hooks/useAgentAuth';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AgentLayoutProps {
  children: ReactNode;
  taskCount?: number;
  breadcrumbs?: BreadcrumbItem[];
}

export default function AgentLayout({ children, taskCount, breadcrumbs }: AgentLayoutProps) {
  const { isReady, isLoading } = useAgentAuth();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading…</span>
          </div>
        </div>
      </MainLayout>
    );
  }

  // useAgentAuth will redirect to /signin if needed.
  if (!isReady) return null;

  return (
    <MainLayout>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <AgentSidebar taskCount={taskCount} />
        <main className="flex-1 overflow-auto">
          <div className="px-4 pt-4 lg:px-6">
            <AgentBreadcrumb items={breadcrumbs} />
          </div>
          {children}
        </main>
      </div>
    </MainLayout>
  );
}
