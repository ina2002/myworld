export type ItemType = 'note' | 'link' | 'sticker' | 'pdf';

export interface ScrapbookItem {
  id: string;
  type: ItemType;
  content?: string;
  title?: string;
  rating?: number;
  tags: string[];
  x: number;
  y: number;
  rotation: number;
  scale: number;
  file_path?: string;
  created_at?: string;
}
