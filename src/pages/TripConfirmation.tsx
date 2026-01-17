import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { useParams } from 'react-router-dom';

export default function TripConfirmation() {
  const { tripId } = useParams();
  return (
    <MainLayout>
      <Head title="Booking Confirmed | Voyance" />
      <section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">🎉 Booking Confirmed!</h1>
          <p className="text-muted-foreground">Confirmation: {tripId}</p>
        </div>
      </section>
    </MainLayout>
  );
}
