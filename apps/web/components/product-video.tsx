'use client';

import { useRef, useState } from 'react';

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
            playing
              ? 'scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100'
              : 'scale-100 opacity-100'
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
