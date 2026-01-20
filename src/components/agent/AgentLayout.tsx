import { ReactNode } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import AgentSidebar from './AgentSidebar';

interface AgentLayoutProps {
  children: ReactNode;
  taskCount?: number;
}

export default function AgentLayout({ children, taskCount }: AgentLayoutProps) {
  return (
    <MainLayout>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <AgentSidebar taskCount={taskCount} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </MainLayout>
  );
}
