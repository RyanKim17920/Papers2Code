export interface UpdateItem {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO or human readable
  tag?: 'New' | 'UI' | 'Fix' | 'Notice' | string;
}
