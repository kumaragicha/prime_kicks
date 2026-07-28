'use client';
import { MasterManager } from '@/components/master-manager'; import { useBrands } from '@/lib/hooks';
export default function BrandsPage() { const { data, isLoading } = useBrands(); return <MasterManager title="Brands" description="One brand can be selected for each product." resource="brands" items={data} loading={isLoading} />; }
