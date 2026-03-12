export type ItemType = 'note' | 'link' | 'sticker' | 'pdf' | 'text' | 'drawing';

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
  width?: number;
  variant?: string;
  file_path?: string;
  created_at?: string;
}
