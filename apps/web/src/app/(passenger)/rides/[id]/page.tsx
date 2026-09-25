import { RideDetailPage } from '@/features/rides/ride-detail-page';

export const metadata = { title: 'Ride · Dhaka Tesla Pool' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RideDetailPage id={id} />;
}
