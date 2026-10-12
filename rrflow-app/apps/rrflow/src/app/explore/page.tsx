import type { Metadata } from 'next';
import { BrainExplorer } from '@/components/explore/brain-explorer';

export const metadata: Metadata = {
  title: 'Brain Explorer · RRFLOW',
  description: 'Every HydraDB brain this workspace can reach, with drill-down and a Query Lab.',
};

/** Standalone preview route; the dashboard embeds `<BrainExplorer embedded />`. */
export default function ExplorePage() {
  return (
    <main>
      <BrainExplorer />
    </main>
  );
}
