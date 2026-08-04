'use client';

import { use } from 'react';
import type { DefaultValues } from 'react-hook-form';
import type { CreateProductSchema } from '@prime-kicks/validation';
import { ProductForm } from '@/components/product-form';
import { useProduct, useUpdateProduct } from '@/lib/hooks';
import { useToast } from '@/lib/toast';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const { data: product, isLoading, isError } = useProduct(id);
  const updateProduct = useUpdateProduct(id);

  if (isLoading) return <p className="text-neutral-500">Loading…</p>;
  if (isError || !product) return <p className="text-red-600">Product not found.</p>;

  const defaultValues: DefaultValues<CreateProductSchema> = {
    sku: product.sku,
    name: product.name,
    brandId: product.brandId ?? '',
    productTypeIds: product.productTypes.map((type) => type.id),
    categoryIds: product.categories.map((category) => category.id),
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
  };

  const onSubmit = async (values: CreateProductSchema) => {
    await updateProduct.mutateAsync(values);
    toast.success('Changes saved.');
  };

  return (
    <div>
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
