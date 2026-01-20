/**
 * Agent Payouts Page
 * 
 * Full dashboard for managing agent earnings and payouts
 */

import { Banknote } from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import AgentPayoutsDashboard from '@/components/agent/AgentPayoutsDashboard';
import StripeConnectOnboarding from '@/components/agent/StripeConnectOnboarding';

export default function AgentPayouts() {
  return (
    <AgentLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/agent' },
        { label: 'Payouts' }
      ]}
    >
      <Head
        title="Payouts | AgentOS"
        description="Manage your earnings and payout settings"
      />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Banknote className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Payouts</h1>
            <p className="text-muted-foreground">
              Track earnings and manage your payout settings
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Stripe Connect Status */}
          <StripeConnectOnboarding />

          {/* Payout Dashboard */}
          <AgentPayoutsDashboard />
        </div>
      </div>
    </AgentLayout>
  );
}
