'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { ImageCropModal } from './image-crop-modal';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const VIDEO_ACCEPT = 'video/mp4,video/webm';

/** Target frame the storefront shows product photos in (card is aspect-[1/1.05]). */
const STORE_ASPECT = 1 / 1.05;

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
  aspect = STORE_ASPECT,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  /** Crop frame (width / height). Defaults to the store product-card ratio. */
  aspect?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Files waiting to be cropped-into-frame before upload (one modal at a time).
  const [cropQueue, setCropQueue] = useState<File[]>([]);

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

  /** Pick files → queue them for the crop-into-frame step (not uploaded yet). */
  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    const picked = Array.from(files).slice(0, remaining);
    if (files.length > remaining) {
      setError(`You can add ${max} photos in total.`);
    }
    setCropQueue(picked);
    if (inputRef.current) inputRef.current.value = '';
  }

  /** Upload one already-cropped file, then advance the crop queue. */
  async function uploadCropped(cropped: File) {
    setUploading((n) => n + 1);
    try {
      const { url } = await api.uploadImage(cropped);
      onChange([...currentRef.current, url]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading((n) => n - 1);
      setCropQueue((q) => q.slice(1));
    }
  }

  /** Skip the current file in the crop queue without uploading it. */
  function skipCropped() {
    setCropQueue((q) => q.slice(1));
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
      {/*
        Accept reorder-drops anywhere in the grid — tiles, gaps, and the "Add
        photo" tile — so a released drag is always a valid drop and the browser
        never cancels it (a cancelled drag synthesises a stray click).
      */}
      <div
        className="grid grid-cols-4 gap-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragIndex(null);
          setOverIndex(null);
        }}
      >
        {value.map((url, i) => (
          <div
            key={url}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragEnter={() => setOverIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
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

        {value.length + uploading < max && cropQueue.length === 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setDragIndex(null);
              setOverIndex(null);
            }}
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

      {cropQueue[0] && (
        <ImageCropModal
          key={cropQueue.length}
          file={cropQueue[0]}
          aspect={aspect}
          title={cropQueue.length > 1 ? `Adjust photo (${cropQueue.length} left)` : 'Adjust photo'}
          onApply={uploadCropped}
          onCancel={skipCropped}
        />
      )}
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
  const [copied, setCopied] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  // Track the URL we uploaded in THIS session. Only that one is safe to
  // hard-delete on remove — a pasted/reused URL may belong to another product,
  // so removing it here must not delete the shared file from storage.
  const freshUploadRef = useRef<string | null>(null);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url } = await api.uploadVideo(file);
      freshUploadRef.current = url;
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  /** Attach a video by pasting an existing URL — no upload, so files are reused. */
  function applyUrl() {
    const url = urlDraft.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError('Enter a full URL starting with http:// or https://');
      return;
    }
    setError('');
    freshUploadRef.current = null; // pasted → not ours to delete
    setUrlDraft('');
    onChange(url);
  }

  async function copyUrl() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy — select the URL and copy manually.');
    }
  }

  function removeVideo() {
    const url = value;
    const wasFreshUpload = url != null && url === freshUploadRef.current;
    freshUploadRef.current = null;
    onChange(null);
    // Only delete from the bucket if WE uploaded this file this session. A
    // pasted/reused URL may be shared with another product — just unlink it.
    if (url && wasFreshUpload) {
      api.deleteUpload(url).catch(() => setError("Removed, but couldn't delete the file from storage."));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <>
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

          {/* Copyable URL — paste it into another product to reuse the same video. */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={value}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-700"
            />
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-900"
            >
              {copied ? 'Copied ✓' : 'Copy URL'}
            </button>
          </div>
        </>
      ) : (
        <>
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

          {/* Or reuse an existing video by pasting its URL — no re-upload. */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyUrl();
                }
              }}
              placeholder="…or paste a video URL"
              disabled={uploading}
              className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1.5 text-xs text-neutral-700 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={applyUrl}
              disabled={uploading || !urlDraft.trim()}
              className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-900 disabled:opacity-40"
            >
              Use URL
            </button>
          </div>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />

      <p className="text-xs text-neutral-500">
        MP4 or WebM · one video · or paste a URL to reuse a video from another product.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
