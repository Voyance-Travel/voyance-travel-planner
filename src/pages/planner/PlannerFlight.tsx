import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';

export default function PlannerFlight() {
  return (
    <MainLayout>
      <Head title="Select Flights | Voyance" />
      <section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Select Your Flights</h1>
          <p className="text-muted-foreground">Flight selection coming soon...</p>
        </div>
      </section>
    </MainLayout>
  );
}
