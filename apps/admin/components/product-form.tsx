'use client';

import { ImageUploader, VideoUploader } from '@/components/media-uploader';
import { QuantityStepper } from '@/components/quantity-stepper';
import {
  useBrands,
  useCategories,
  useDimensions,
  useProductModels,
  useProductTypes,
  useSizeTypes,
  useTags,
} from '@/lib/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDimension, formatSize } from '@prime-kicks/types';
import { Button } from '@prime-kicks/ui';
import { createProductSchema, type CreateProductSchema } from '@prime-kicks/validation';
import { useMemo, useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';

const fieldClass =
  'w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none';

/** Build a unique-ish SKU like "NIK-LZ4F9A2" from the brand + time + randomness. */
function generateSku(brand?: string): string {
  const prefix =
    (brand ?? '')
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'PK';
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}${rand}`;
}

const emptyDefaults: DefaultValues<CreateProductSchema> = {
  sku: '',
  name: '',
  brandId: '',
  model: null,
  productTypeIds: [],
  categoryIds: [],
  tagIds: [],
  description: '',
  currency: 'INR',
  photoUrls: [],
  videoUrl: null,
  releaseYear: null,
  sizeTypeId: '',
  variants: [],
  dimensionId: null,
};

export function ProductForm({
  defaultValues,
  submitLabel,
  onSubmit,
  errorMessage,
  sharedPhotoUrls,
}: {
  defaultValues?: DefaultValues<CreateProductSchema>;
  submitLabel: string;
  onSubmit: (values: CreateProductSchema) => Promise<void>;
  errorMessage?: string;
  /** Photos owned by a different product (this form was seeded by duplicating
   *  it), so removing one here must not delete the file from storage. */
  sharedPhotoUrls?: string[];
}) {
  const { data: sizeTypes, isLoading: loadingTypes } = useSizeTypes();
  const { data: brands } = useBrands();
  const { data: productTypes } = useProductTypes();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data: dimensions } = useDimensions();

  // Per-size stock, keyed by sizeId — seeded from defaultValues in edit mode.
  const [stockBySize, setStockBySize] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const v of defaultValues?.variants ?? []) {
      if (v && typeof v.sizeId === 'string') initial[v.sizeId] = Number(v.stock ?? 0);
    }
    return initial;
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductSchema>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  const selectedTypeId = watch('sizeTypeId');
  const selectedType = useMemo(
    () => sizeTypes?.find((t) => t.id === selectedTypeId),
    [sizeTypes, selectedTypeId],
  );

  // Model autocomplete suggestions, scoped to the currently-selected brand.
  const selectedBrandId = watch('brandId');
  const { data: modelSuggestions } = useProductModels(selectedBrandId || undefined);

  const totalStock = Object.values(stockBySize).reduce((sum, n) => sum + (n || 0), 0);

  const submit = handleSubmit(async (values) => {
    const variants = (selectedType?.sizes ?? [])
      .map((s) => ({ sizeId: s.id, stock: stockBySize[s.id] ?? 0, sku: null }))
      .filter((v) => v.stock > 0);

    // SKU is auto-generated for new products; existing products keep theirs.
    const brandName = brands?.find((b) => b.id === values.brandId)?.name;
    const sku = values.sku?.trim() || generateSku(brandName);

    // A blank dimension select ("") means "no dimension".
    const dimensionId = values.dimensionId || null;

    return onSubmit({ ...values, sku, variants, dimensionId });
  });

  return (
    <form onSubmit={submit} className="flex w-full max-w-lg flex-col gap-4">
      <Field label="Name" error={errors.name?.message}>
        <input className={fieldClass} {...register('name')} />
      </Field>

      <Field label="Brand" error={errors.brandId?.message}>
        <select className={fieldClass} {...register('brandId')}>
          <option value="">Select brand</option>
          {brands?.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Model (groups colorways)" error={errors.model?.message}>
        <input
          className={fieldClass}
          list="product-model-suggestions"
          placeholder="e.g. Samba — same model groups colorways together"
          {...register('model')}
        />
        <datalist id="product-model-suggestions">
          {modelSuggestions?.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      <Field label="Types" error={errors.productTypeIds?.message as string | undefined}>
        <div className="grid grid-cols-2 gap-2">
          {productTypes?.map((type) => (
            <label key={type.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={type.id} {...register('productTypeIds')} />
              {type.name}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Categories" error={errors.categoryIds?.message as string | undefined}>
        <div className="grid grid-cols-2 gap-2">
          {categories?.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={category.id} {...register('categoryIds')} />
              {category.name}
            </label>
          ))}
        </div>
      </Field>

      {tags && tags.length > 0 && (
        <Field label="Tags" error={errors.tagIds?.message as string | undefined}>
          <div className="grid grid-cols-2 gap-2">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" value={tag.id} {...register('tagIds')} />
                {tag.name}
              </label>
            ))}
          </div>
        </Field>
      )}

      <Field label="Description" error={errors.description?.message}>
        <textarea className={fieldClass} rows={3} {...register('description')} />
      </Field>

      <Field label="Photos" error={errors.photoUrls?.message as string | undefined}>
        <ImageUploader
          value={watch('photoUrls') ?? []}
          onChange={(urls) =>
            setValue('photoUrls', urls, { shouldValidate: true, shouldDirty: true })
          }
          max={4}
          sharedUrls={sharedPhotoUrls}
        />
      </Field>

      <Field label="Video" error={errors.videoUrl?.message}>
        <VideoUploader
          value={watch('videoUrl') ?? null}
          onChange={(url) => setValue('videoUrl', url, { shouldValidate: true, shouldDirty: true })}
        />
      </Field>

      {/* Sizing */}
      <Field label="Size type" error={errors.sizeTypeId?.message}>
        <select className={fieldClass} {...register('sizeTypeId')} disabled={loadingTypes}>
          <option value="">{loadingTypes ? 'Loading…' : 'Select a size type'}</option>
          {sizeTypes?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      {selectedType && (
        <div className="rounded-md border border-neutral-200 p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-neutral-700">
              Stock per size ({selectedType.name})
            </span>
            <span className="text-sm text-neutral-500">Total: {totalStock}</span>
          </div>
          {selectedType.sizes.length === 0 && (
            <p className="text-sm text-neutral-500">
              This size type has no sizes yet. Add some under “Sizes”.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {selectedType.sizes.map((size) => (
              <label key={size.id} className="flex flex-col gap-1">
                <span className="text-xs text-neutral-600">{formatSize(size)}</span>
                <QuantityStepper
                  value={stockBySize[size.id] ?? 0}
                  onChange={(val) => setStockBySize((prev) => ({ ...prev, [size.id]: val }))}
                  min={0}
                  label={`stock for ${formatSize(size)}`}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Dimension — optional, at most one per product. */}
      <Field label="Dimension" error={errors.dimensionId?.message}>
        <select className={fieldClass} {...register('dimensionId')}>
          <option value="">No dimension</option>
          {dimensions?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.weight} kg · {formatDimension(d)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="In-house cost (₹)" error={errors.inhouseCost?.message}>
        <input
          type="number"
          className={fieldClass}
          {...register('inhouseCost', { valueAsNumber: true })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reseller price (₹)" error={errors.resellerPrice?.message}>
          <input
            type="number"
            className={fieldClass}
            {...register('resellerPrice', { valueAsNumber: true })}
          />
        </Field>

        <Field label="Customer price (₹)" error={errors.customerPrice?.message}>
          <input
            type="number"
            className={fieldClass}
            {...register('customerPrice', { valueAsNumber: true })}
          />
        </Field>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600 font-medium">Error: {errorMessage}</p>
        </div>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  // A <div>, deliberately NOT a <label>: clicking anywhere inside a <label>
  // forwards a synthetic click to its first form control. With composite
  // children (photo grid, video, checkbox groups) that stray click landed on
  // whatever control came first — deleting photos and popping the file picker.
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
