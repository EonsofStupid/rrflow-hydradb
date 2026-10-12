import type { Metadata } from 'next';
import { LiveMesh } from '@/components/live/live-mesh';

export const metadata: Metadata = { title: 'RRFLOW · Live brains', description: 'Live view of the RRFLOW brain mesh in HydraDB.' };

const LivePage = () => (
  <main className="container py-8">
    <LiveMesh />
  </main>
);

export default LivePage;
