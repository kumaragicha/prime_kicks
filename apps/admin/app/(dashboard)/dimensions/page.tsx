'use client';
import CombinationsManager from '@/components/combinations-manager';
import { DimensionManager } from '@/components/dimension-manager';
import { useDimensions } from '@/lib/hooks';

export default function DimensionsPage() {
  const { data, isLoading } = useDimensions(true);
  return (
    <CombinationsManager topSection={<DimensionManager items={data} loading={isLoading} />} />
  );
}
