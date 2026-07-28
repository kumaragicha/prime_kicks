'use client';
import { MasterManager } from '@/components/master-manager'; import { useProductTypes } from '@/lib/hooks';
export default function ProductTypesPage() { const { data, isLoading } = useProductTypes(); return <MasterManager title="Product types" description="Products can belong to more than one type." resource="product-types" items={data} loading={isLoading} />; }
