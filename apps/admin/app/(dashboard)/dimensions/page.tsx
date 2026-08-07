'use client';
import { DimensionManager } from '@/components/dimension-manager';
import { useDimensions } from '@/lib/hooks';

export default function DimensionsPage() {
  const { data, isLoading } = useDimensions(true);
  return <DimensionManager items={data} loading={isLoading} />;
}
