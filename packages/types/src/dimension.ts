export interface Dimension {
  id: string;
  name: string;
  /** Kilograms — used as the shipment weight when mapped to a product. */
  weight: number;
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

/** One recipe line of a combination. */
export interface DimensionCombinationItem {
  id: string;
  dimensionId: string;
  quantity: number;
  dimension?: Dimension;
}

/** A quantity-based shipment rule (recipe of dimensions → weight + box). */
export interface DimensionCombination {
  id: string;
  name: string;
  /** Kilograms — resulting shipment weight when this combination matches. */
  weight: number;
  boxDimensionId: string;
  boxDimension?: Dimension;
  isActive: boolean;
  items: DimensionCombinationItem[];
  createdAt: string;
  updatedAt: string;
}
