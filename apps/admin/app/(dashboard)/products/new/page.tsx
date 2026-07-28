'use client';

import { useRouter } from 'next/navigation';
import type { CreateProductSchema } from '@prime-kicks/validation';
import { ProductForm } from '@/components/product-form';
import { useCreateProduct } from '@/lib/hooks';

export default function NewProductPage() {
  const router = useRouter();
  const createProduct = useCreateProduct();

  const onSubmit = async (values: CreateProductSchema) => {
    await createProduct.mutateAsync(values);
    router.push('/');
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">New product</h1>
      <ProductForm
        submitLabel="Create product"
        onSubmit={onSubmit}
        errorMessage={
          createProduct.isError
            ? createProduct.error instanceof Error && createProduct.error.message.includes('409')
              ? 'A product with this SKU already exists. Use a different SKU.'
              : 'Something went wrong. Check the API is running.'
            : undefined
        }
      />
    </div>
  );
}
