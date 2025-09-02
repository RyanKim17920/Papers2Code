import type { UpdateItem } from '@/common/types/update';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockUpdates: UpdateItem[] = [
  {
    id: 'u3',
    title: 'Saved moved into Feed',
    description: "Access your saved papers from the 'Saved' tab in the Feed.",
    date: new Date().toISOString(),
    tag: 'New',
  },
  {
    id: 'u4',
    title: 'Feed header spacing tweak',
    description: 'Feed tabs are now placed below the title for clarity.',
    date: new Date().toISOString(),
    tag: 'UI',
  },
];

export const fetchLatestUpdates = async (): Promise<UpdateItem[]> => {
  await delay(300);
  // Replace with real HTTP call later
  return mockUpdates;
};
