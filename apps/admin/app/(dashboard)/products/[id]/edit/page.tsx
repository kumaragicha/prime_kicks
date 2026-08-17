'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, use } from 'react';
import type { DefaultValues } from 'react-hook-form';
import type { CreateProductSchema } from '@prime-kicks/validation';
import { ProductForm } from '@/components/product-form';
import { useProduct, useUpdateProduct } from '@/lib/hooks';
import { useToast } from '@/lib/toast';

function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();

  // The list page hands over its own query string as `from` (page, search,
  // filters) so both "Back to products" and a successful save return to the page
  // the admin was actually on. Re-encoded through `URLSearchParams`, so a value
  // that isn't a query string can never redirect off `/products`.
  const from = search.get('from');
  const listHref = from ? `/products?${new URLSearchParams(from).toString()}` : '/products';
  const { data: product, isLoading, isError } = useProduct(id);
  const updateProduct = useUpdateProduct(id);

  if (isLoading) return <p className="text-neutral-500">Loading…</p>;
  if (isError || !product) return <p className="text-red-600">Product not found.</p>;

  const defaultValues: DefaultValues<CreateProductSchema> = {
    sku: product.sku,
    name: product.name,
    brandId: product.brandId ?? '',
    model: product.model ?? null,
    productTypeIds: product.productTypes.map((type) => type.id),
    categoryIds: product.categories.map((category) => category.id),
    tagIds: product.tags?.map((tag) => tag.id) ?? [],
    description: product.description,
    currency: product.currency,
    photoUrls: product.photoUrls,
    videoUrl: product.videoUrl,
    releaseYear: product.releaseYear,
    inhouseCost: product.inhouseCost,
    resellerPrice: product.resellerPrice,
    customerPrice: product.customerPrice,
    sizeTypeId: product.sizeTypeId,
    variants: product.variants.map((v) => ({ sizeId: v.sizeId, stock: v.stock, sku: v.sku })),
    dimensionId: product.dimensionId ?? null,
  };

  const onSubmit = async (values: CreateProductSchema) => {
    await updateProduct.mutateAsync(values);
    toast.success('Changes saved.');
    // Back to the exact page of the list the admin came from. The toast lives on
    // the root provider, so it survives the navigation.
    router.push(listHref);
  };

  return (
    <div>
      <Link
        href={listHref}
        className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to products
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Edit product</h1>
      <ProductForm
        defaultValues={defaultValues}
        submitLabel="Save changes"
        onSubmit={onSubmit}
        errorMessage={
          updateProduct.error instanceof Error
            ? updateProduct.error.message
            : updateProduct.isError
              ? 'Update failed. Check the API is running.'
              : undefined
        }
      />
    </div>
  );
}

// `useSearchParams` needs a boundary to suspend against while the client shell
// hydrates.
export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
      <EditProduct params={params} />
    </Suspense>
  );
}
