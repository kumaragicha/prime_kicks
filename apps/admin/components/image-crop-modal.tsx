'use client';

import { Button } from '@prime-kicks/ui';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Crop/position a picked image into a fixed aspect frame BEFORE upload, so the
 * stored file already matches the storefront frame (no focal-point metadata or
 * render-time object-position needed). Drag to pan, slider/wheel to zoom; on
 * apply we render the visible frame to a canvas and hand back a JPEG File that
 * the existing upload endpoint re-encodes to WebP.
 */
export function ImageCropModal({
  file,
  aspect,
  title = 'Adjust photo',
  onCancel,
  onApply,
}: {
  file: File;
  /** width / height of the target frame (e.g. 1 / 1.05 for the store card). */
  aspect: number;
  title?: string;
  onCancel: () => void;
  onApply: (cropped: File) => void;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [objectUrl, setObjectUrl] = useState('');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1); // 1 = "cover" (min), up to MAX_ZOOM
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // image top-left within the frame
  const [busy, setBusy] = useState(false);

  const MAX_ZOOM = 4;

  // Load the picked file into an off-DOM image to read its natural size.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Measure the frame element (responsive width) so the pan/zoom maths use real px.
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => setView({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const coverScale =
    natural && view.w && view.h ? Math.max(view.w / natural.w, view.h / natural.h) : 1;
  const scale = coverScale * zoom;
  const dw = natural ? natural.w * scale : 0;
  const dh = natural ? natural.h * scale : 0;

  const clampOffset = useCallback(
    (x: number, y: number) => ({
      x: Math.min(0, Math.max(view.w - dw, x)),
      y: Math.min(0, Math.max(view.h - dh, y)),
    }),
    [view.w, view.h, dw, dh],
  );

  // Center the image whenever the source or frame size first resolves.
  useEffect(() => {
    if (!natural || !view.w || !view.h) return;
    setOffset(clampOffset((view.w - dw) / 2, (view.h - dh) / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, view.w, view.h]);

  // Zoom around the frame center so the focus point stays put.
  function applyZoom(nextZoom: number) {
    const z = Math.min(MAX_ZOOM, Math.max(1, nextZoom));
    if (!natural) return setZoom(z);
    const newScale = coverScale * z;
    // natural coord currently under the frame center
    const cx = (view.w / 2 - offset.x) / scale;
    const cy = (view.h / 2 - offset.y) / scale;
    const nx = view.w / 2 - cx * newScale;
    const ny = view.h / 2 - cy * newScale;
    setZoom(z);
    setOffset({
      x: Math.min(0, Math.max(view.w - natural.w * newScale, nx)),
      y: Math.min(0, Math.max(view.h - natural.h * newScale, ny)),
    });
  }

  // ---- pan ----
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault(); // stop the browser from starting a native image drag
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.px);
    const ny = drag.current.oy + (e.clientY - drag.current.py);
    setOffset(clampOffset(nx, ny));
  }
  function onPointerUp(e: React.PointerEvent) {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function onWheel(e: React.WheelEvent) {
    applyZoom(zoom - e.deltaY * 0.0015 * zoom);
  }

  async function apply() {
    const img = imgRef.current;
    if (!img || !natural || !view.w) return;
    setBusy(true);
    try {
      const MAX_OUT = 2000;
      const sx = (0 - offset.x) / scale;
      const sy = (0 - offset.y) / scale;
      const sw = view.w / scale;
      const sh = view.h / scale;
      const factor = Math.min(1, MAX_OUT / Math.max(sw, sh));
      const outW = Math.max(1, Math.round(sw * factor));
      const outH = Math.max(1, Math.round(sh * factor));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no-canvas');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob(res, 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('no-blob');
      const base = file.name.replace(/\.[^.]+$/, '');
      onApply(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
    } finally {
      setBusy(false);
    }
  }

  // Portal to <body>: this modal is used inside the product form, whose
  // ancestors can carry CSS transforms — a transformed ancestor turns
  // position:fixed into position:absolute-within-it, so the backdrop no longer
  // covered the viewport and clicks leaked through to the photo grid behind
  // (removing photos / reopening the file picker). From <body>, fixed is
  // always viewport-relative and the backdrop truly blocks the page.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-base font-semibold text-neutral-900">{title}</h3>
        <p className="mb-4 text-xs text-neutral-500">
          Drag to reposition · scroll or use the slider to zoom. The frame matches the store.
        </p>

        <div
          ref={viewRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onDragStart={(e) => e.preventDefault()}
          draggable={false}
          className="relative mx-auto w-full max-w-[320px] cursor-move touch-none select-none overflow-hidden rounded-lg bg-neutral-100"
          style={{ aspectRatio: String(aspect) }}
        >
          {objectUrl && natural && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={objectUrl}
              alt="Crop preview"
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none"
              style={{
                width: dw || undefined,
                height: dh || undefined,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          {/* subtle rule-of-thirds guides */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
            <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
            <div className="absolute top-1/3 left-0 h-px w-full bg-white/30" />
            <div className="absolute top-2/3 left-0 h-px w-full bg-white/30" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-neutral-500">Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="flex-1 accent-neutral-900"
          />
        </div>

        {/* type="button" is critical: this modal renders INSIDE the product
            <form>, and the shared Button defaults to type="submit" — without
            it, Apply/Cancel would also submit (save) the whole product form. */}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={apply} disabled={busy || !natural}>
            {busy ? 'Applying…' : 'Apply & upload'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
