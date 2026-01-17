import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { useParams } from 'react-router-dom';

export default function ItineraryView() {
  const { id } = useParams();
  return (
    <MainLayout>
      <Head title="Itinerary | Voyance" />
      <section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Your Itinerary</h1>
          <p className="text-muted-foreground">Itinerary ID: {id}</p>
          <p className="text-sm text-muted-foreground mt-4">Full itinerary view coming soon...</p>
        </div>
      </section>
    </MainLayout>
  );
}
