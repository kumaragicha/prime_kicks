'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const VIDEO_ACCEPT = 'video/mp4,video/webm';

/** Small centered circular spinner shown while a file uploads. */
function Spinner({ size = 22 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Uploading"
    />
  );
}

/* -------------------------------- Images -------------------------------- */

export function ImageUploader({
  value,
  onChange,
  max = 4,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Live ref to the latest value so sequential awaits append correctly.
  const currentRef = useRef(value);
  currentRef.current = value;

  const remaining = max - value.length;

  /** Move a thumbnail from one position to another — this order is what the web shows. */
  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onChange(next);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    const picked = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      setError(`You can add ${max} photos in total.`);
    }
    setUploading((n) => n + picked.length);
    // Upload all picked files in parallel — they're independent, so there's no
    // reason to wait for each round-trip. Order is preserved by keeping the
    // results in the picked order and appending the successful ones in one go.
    const settled = await Promise.all(
      picked.map(async (file) => {
        try {
          const { url } = await api.uploadImage(file);
          return url;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed.');
          return null;
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    const uploaded = settled.filter((url): url is string => url !== null);
    if (uploaded.length > 0) onChange([...currentRef.current, ...uploaded]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeAt(index: number) {
    const url = value[index];
    onChange(value.filter((_, i) => i !== index));
    // Best-effort: also remove the object from the bucket so nothing orphans.
    if (url) {
      api.deleteUpload(url).catch(() => setError("Removed, but couldn't delete the file from storage."));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        {value.map((url, i) => (
          <div
            key={url}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragEnter={() => setOverIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={`group relative aspect-square cursor-move overflow-hidden rounded-md border bg-neutral-100 transition ${
              dragIndex === i
                ? 'opacity-40'
                : overIndex === i
                  ? 'border-neutral-900 ring-2 ring-neutral-900'
                  : 'border-neutral-200'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              draggable={false}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {i === 0 && (
              <span className="absolute left-1 top-1 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition group-hover:opacity-100"
              aria-label={`Remove photo ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}

        {Array.from({ length: Math.max(0, uploading) }).map((_, i) => (
          <div
            key={`up-${i}`}
            className="flex aspect-square items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50"
          >
            <Spinner />
          </div>
        ))}

        {value.length + uploading < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 bg-white text-neutral-500 transition hover:border-neutral-900 hover:text-neutral-900"
          >
            <span className="text-xl leading-none">+</span>
            <span className="text-xs">Add photo</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <p className="text-xs text-neutral-500">
        JPG, PNG or WebP · up to {max} · converted to optimized WebP.
        {value.length > 1 && ' Drag to reorder — the first image is the cover shown on the store.'}
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* -------------------------------- Video --------------------------------- */

export function VideoUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url } = await api.uploadVideo(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeVideo() {
    const url = value;
    onChange(null);
    // Best-effort: also remove the object from the bucket so nothing orphans.
    if (url) {
      api.deleteUpload(url).catch(() => setError("Removed, but couldn't delete the file from storage."));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="relative overflow-hidden rounded-md border border-neutral-200 bg-black">
          <video
            src={value}
            controls
            playsInline
            preload="metadata"
            className="max-h-64 w-full"
          />
          <button
            type="button"
            onClick={removeVideo}
            className="absolute right-2 top-2 flex h-7 items-center gap-1 rounded-full bg-black/60 px-3 text-xs text-white"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-28 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 bg-white text-neutral-500 transition hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-60"
        >
          {uploading ? (
            <Spinner />
          ) : (
            <>
              <span className="text-xl leading-none">＋</span>
              <span className="text-sm">Add video</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />

      <p className="text-xs text-neutral-500">MP4 or WebM · one video.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
