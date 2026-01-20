import { ReactNode } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import AgentSidebar from './AgentSidebar';
import AgentBreadcrumb from './AgentBreadcrumb';

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
