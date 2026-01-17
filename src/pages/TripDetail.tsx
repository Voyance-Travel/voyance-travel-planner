import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { useParams } from 'react-router-dom';

export default function TripDetail() {
  const { tripId } = useParams();
  return (
    <MainLayout>
      <Head title="Trip Details | Voyance" />
      <section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Trip Details</h1>
          <p className="text-muted-foreground">Trip ID: {tripId}</p>
          <p className="text-sm text-muted-foreground mt-4">Full trip details coming soon...</p>
        </div>
      </section>
    </MainLayout>
  );
}
