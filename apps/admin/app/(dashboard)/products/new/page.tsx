'use client';

import { ProductForm } from '@/components/product-form';
import { useCreateProduct } from '@/lib/hooks';
import type { CreateProductSchema } from '@prime-kicks/validation';
import { useRouter } from 'next/navigation';

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
