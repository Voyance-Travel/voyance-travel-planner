import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { useTripPlanner } from '@/contexts/TripPlannerContext';

export default function Planner() {
  const { state } = useTripPlanner();
  return (
    <MainLayout>
      <Head title="Trip Planner | Voyance" />
      <section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Trip Planner</h1>
          <p className="text-muted-foreground">Planning trip to: {state.basics.destination || 'Not selected'}</p>
          <p className="text-sm text-muted-foreground mt-8">Full planner flow coming soon...</p>
        </div>
      </section>
    </MainLayout>
  );
}
