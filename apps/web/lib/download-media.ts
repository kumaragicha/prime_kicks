const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/** The API's media proxy: serves CDN files with `Content-Disposition: attachment`. */
function proxyUrl(url: string) {
  return `${API_URL}/uploads/download?url=${encodeURIComponent(url)}`;
}

/** `jpg` / `webp` / … from a CDN key, defaulting to `jpg` for odd URLs. */
function extensionOf(url: string) {
  const name = url.split(/[?#]/)[0]?.split('/').pop() ?? '';
  const ext = name.includes('.') ? name.split('.').pop() : '';
  return (ext ?? '').toLowerCase().slice(0, 5) || 'jpg';
}

/** "Nike Air Max 90" → "nike-air-max-90", so saved files are recognisable. */
function slug(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'product'
  );
}

/** `prime-kicks-nike-air-max-90-2.jpg` */
export function mediaFilename(productName: string, url: string, index: number) {
  return `prime-kicks-${slug(productName)}-${index + 1}.${extensionOf(url)}`;
}

/**
 * Save one media file to the visitor's device.
 *
 * Goes through the API proxy for two reasons: the CDN sends no
 * `Content-Disposition`, so a plain link opens the image in a tab instead of
 * saving it, and it sends no CORS headers either, so the browser can't fetch the
 * bytes directly. The proxy fixes both — fetching it gives us a blob we can name
 * ourselves (`prime-kicks-<product>-<n>.jpg` rather than a bare uuid).
 *
 * Throws when the proxy answers with an error status, so the caller can tell the
 * visitor. Only a *transport* failure (offline, blocked request) falls back to
 * navigating to the proxy URL — navigating on an HTTP error would replace the
 * page with the API's JSON error body.
 */
export async function downloadMedia(url: string, filename: string) {
  const href = proxyUrl(url);

  let blob: Blob;
  try {
    const res = await fetch(href);
    if (!res.ok) {
      // Server said no (missing object, bad url) — surface it, don't navigate.
      throw new MediaDownloadError(`The file could not be fetched (${res.status}).`);
    }
    blob = await res.blob();
  } catch (error) {
    if (error instanceof MediaDownloadError) throw error;
    // fetch itself never reached the API: a plain navigation still downloads,
    // just with the server's uuid filename instead of ours.
    window.location.href = href;
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke late — Safari aborts the save if the object URL dies too soon.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

/** A download the server refused, as opposed to a request that never landed. */
export class MediaDownloadError extends Error {}

/**
 * Save several files one after another, awaiting each before starting the next.
 *
 * Deliberately sequential: firing four downloads in the same tick makes Chrome
 * and Safari drop all but the first as "multiple automatic downloads", and it
 * hammers the proxy with parallel streams. `onProgress` reports completed count
 * so the caller can show "2 / 4".
 */
export async function downloadMediaSequentially(
  items: { url: string; filename: string }[],
  onProgress?: (done: number, total: number) => void,
) {
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item) continue;
    await downloadMedia(item.url, item.filename);
    onProgress?.(i + 1, items.length);
    // Breathing room between saves so the browser treats them as distinct
    // user-initiated downloads rather than a burst.
    if (i < items.length - 1) await new Promise((resolve) => setTimeout(resolve, 450));
  }
}
