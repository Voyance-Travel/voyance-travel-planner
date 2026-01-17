import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';

export default function SampleItinerary() {
  return (
    <MainLayout>
      <Head title="Sample Itinerary | Voyance" />
      <section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">Sample Itinerary</h1>
          <p className="text-muted-foreground">Preview what your trip could look like...</p>
        </div>
      </section>
    </MainLayout>
  );
}
