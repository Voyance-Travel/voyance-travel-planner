import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';

export default function TripDashboard() {
  return (
    <MainLayout>
      <Head title="My Trips | Voyance" />
      <section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">My Trips</h1>
          <p className="text-muted-foreground">Trip dashboard coming soon...</p>
        </div>
      </section>
    </MainLayout>
  );
}
