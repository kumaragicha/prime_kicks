'use client';
import { MasterManager } from '@/components/master-manager'; import { useTags } from '@/lib/hooks';
export default function TagsPage() { const { data, isLoading } = useTags(); return <MasterManager title="Tags" description="Merchandising labels like New Arrivals, Hot Selling or Most Demanded. Products can carry more than one tag." resource="tags" items={data} loading={isLoading} />; }
