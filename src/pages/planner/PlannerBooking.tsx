import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';

export default function PlannerBooking() {
  return (
    <MainLayout>
      <Head title="Complete Booking | Voyance" />
      <section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Complete Your Booking</h1>
          <p className="text-muted-foreground">Booking flow coming soon...</p>
        </div>
      </section>
    </MainLayout>
  );
}
