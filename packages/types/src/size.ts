export interface Size {
  id: string;
  sizeTypeId: string;
  label: string;
  conversion: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SizeType {
  id: string;
  name: string;
  isActive: boolean;
  sizes: Size[];
  createdAt: string;
  updatedAt: string;
}

/** How a size reads for display: "36" or "36 · UK 3". */
export function formatSize(size: Pick<Size, 'label' | 'conversion'>): string {
  return size.conversion ? `${size.label} · ${size.conversion}` : size.label;
}
