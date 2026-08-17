'use client';

import { ProductForm } from '@/components/product-form';
import { useCreateProduct, useProduct } from '@/lib/hooks';
import { duplicateFormDefaults } from '@/lib/product-defaults';
import type { CreateProductSchema } from '@prime-kicks/validation';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function NewProduct() {
  const router = useRouter();
  const params = useSearchParams();
  const createProduct = useCreateProduct();

  // Which product this one is being copied from, if any. Set only by the
  // Duplicate action on the products list, which links here as
  // `/products/new?copyFrom=<id>`; reaching this page any other way starts blank.
  const copyFromId = params.get('copyFrom') ?? '';
  const { data: source, isLoading: loadingSource, isError: sourceMissing } = useProduct(copyFromId);

  /** Drop the copied values and remount the form empty. */
  const startBlank = () => router.replace('/products/new', { scroll: false });

  const onSubmit = async (values: CreateProductSchema) => {
    await createProduct.mutateAsync(values);
    // Back to the products list, not the dashboard — the new row is what the
    // admin wants to see next.
    router.push('/products');
  };

  // The form reads its defaults at mount, so hold it back until the source
  // product has arrived — and remount it (via `key`) whenever the source changes.
  if (copyFromId && loadingSource) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">New product</h1>
        <p className="text-neutral-500">Loading the product you’re copying…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">New product</h1>

      {copyFromId && sourceMissing && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          The product you tried to duplicate could not be loaded, so this form is blank. Go{' '}
          <Link href="/products" className="font-medium underline">
            back to products
          </Link>{' '}
          and try the duplicate action again.
        </div>
      )}

      {source && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm text-neutral-700">
            Copied from{' '}
            <span className="font-medium">
              {source.brand} {source.name}
            </span>
            . A new SKU is generated on save. Give it its own name — a brand can’t have two
            products with the same name — and review the photos and per-size stock before you
            publish.
          </p>
          <button
            type="button"
            className="text-sm font-medium text-neutral-600 underline hover:text-neutral-900"
            onClick={startBlank}
          >
            Start blank instead
          </button>
        </div>
      )}

      <ProductForm
        key={source ? `copy-${source.id}` : 'blank'}
        defaultValues={source ? duplicateFormDefaults(source) : undefined}
        // The copied photos are still the source product's files: removing one
        // here drops it from this draft without deleting it from storage.
        sharedPhotoUrls={source?.photoUrls}
        submitLabel="Create product"
        onSubmit={onSubmit}
        errorMessage={
          createProduct.error instanceof Error
            ? createProduct.error.message
            : createProduct.isError
              ? 'Something went wrong. Check the API is running.'
              : undefined
        }
      />
    </div>
  );
}

// `useSearchParams` needs a boundary to suspend against while the client shell
// hydrates.
export default function NewProductPage() {
  return (
    <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
      <NewProduct />
    </Suspense>
  );
}
