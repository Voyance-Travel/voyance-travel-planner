/**
 * Agent Payouts Page
 * 
 * Full dashboard for managing agent earnings and payouts
 */

import { useState } from 'react';
import { Banknote, TrendingUp, Download } from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import AgentPayoutsDashboard from '@/components/agent/AgentPayoutsDashboard';
import StripeConnectOnboarding from '@/components/agent/StripeConnectOnboarding';
import ProfitDashboard from '@/components/agent/ProfitDashboard';
import CommissionImportModal from '@/components/agent/CommissionImportModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AgentPayouts() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('profit');

  return (
    <AgentLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/agent' },
        { label: 'Finance' }
      ]}
    >
      <Head
        title="Finance | AgentOS"
        description="Manage your earnings, profit margins, and payout settings"
      />

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Banknote className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Finance</h1>
            <p className="text-muted-foreground">
              Track profit, commissions, and manage payouts
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="profit" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Profit Dashboard
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-2">
              <Banknote className="h-4 w-4" />
              Payouts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profit" className="space-y-6">
            {/* Profit Dashboard with 3-source tracking */}
            <ProfitDashboard onImportClick={() => setImportModalOpen(true)} />
          </TabsContent>

          <TabsContent value="payouts" className="space-y-6">
            {/* Stripe Connect Status */}
            <StripeConnectOnboarding />

            {/* Payout Dashboard */}
            <AgentPayoutsDashboard />
          </TabsContent>
        </Tabs>
      </div>

      {/* Commission Import Modal */}
      <CommissionImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => setActiveTab('profit')}
      />
    </AgentLayout>
  );
}
