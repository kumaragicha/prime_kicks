'use client';

import { Icon } from '@/components/icon';
import { useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/**
 * Download via the API's media proxy, which serves the file with a
 * Content-Disposition: attachment header. The CDN itself has no CORS policy,
 * so fetching it from the browser fails (and a plain link just opens a tab) —
 * the proxy is the only path that reliably triggers a real download.
 */
function downloadVideo(url: string) {
  window.location.href = `${API_URL}/uploads/download?url=${encodeURIComponent(url)}`;
}

/**
 * Silent, chromeless product video. No native controls — a custom centered
 * button toggles play/pause. Muted + looped so it plays inline like a GIF.
 */
export function ProductVideo({
  src,
  poster,
  label,
}: {
  src: string;
  poster?: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation(); // don't let the gallery treat this as a slide-select
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  return (
    <div className="relative h-full w-full">
      <video
        ref={ref}
        className="block h-full w-full bg-[#111] object-cover"
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        aria-label={label}
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          downloadVideo(src);
        }}
        aria-label="Download video"
        className="absolute bottom-[14px] left-[14px] z-10 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-accent text-white shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition-transform duration-200 hover:scale-110 [&_svg]:h-[18px] [&_svg]:w-[18px]"
      >
        <Icon name="download" />
      </button>

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause video' : 'Play video'}
        className="group absolute inset-0 flex items-center justify-center focus:outline-none"
      >
        {/* Soft pulsing gold ring — only while paused, to gently invite a click */}
        {!playing && (
          <span className="absolute h-[48px] w-[48px] rounded-full bg-accent/40 animate-[pulse-ring_2s_ease-out_infinite]" />
        )}
        <span
          className={`relative flex h-[48px] w-[48px] items-center justify-center rounded-full bg-accent text-ink shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 [&_svg]:h-[38px] [&_svg]:w-[38px] ${
            playing ? 'scale-90 bg-[#111a]/70 text-white' : 'scale-100 opacity-100'
          }`}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="8" y="7" width="3" height="10" rx="1" />
              <rect x="13" y="7" width="3" height="10" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m9 7 8 5-8 5V7Z" />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}
