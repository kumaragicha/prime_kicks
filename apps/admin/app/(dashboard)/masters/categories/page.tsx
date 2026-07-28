'use client';
import { MasterManager } from '@/components/master-manager'; import { useCategories } from '@/lib/hooks';
export default function CategoriesPage() { const { data, isLoading } = useCategories(); return <MasterManager title="Categories" description="Products can be assigned to multiple customer categories." resource="categories" items={data} loading={isLoading} />; }
