export interface Dimension {
  id: string;
  name: string;
  /** Centimetres. */
  length: number;
  /** Centimetres. */
  width: number;
  /** Centimetres. */
  height: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** How a dimension reads for display: "Standard Box · 30 × 20 × 12 cm". */
export function formatDimension(d: Pick<Dimension, 'length' | 'width' | 'height'>): string {
  return `${d.length} × ${d.width} × ${d.height} cm`;
}
