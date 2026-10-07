/**
 * Brand name -> inline SVG mark, for the homepage "Shop by brand" row.
 *
 * Brand records on the API carry only `{ id, name }` (see the `Brand` model), so
 * there is no logo URL to fetch - the storefront owns this mapping instead. That
 * keeps the row on the filters call the page already makes, with no extra
 * request, no schema change, and no image files to deploy.
 *
 * Names are matched against the masters list case- and space-insensitively, so
 * "New Balance", "new balance" and "NEWBALANCE" all resolve to the same row. A
 * row's optional `aliases` cover spellings the masters data actually uses that
 * normalising alone won't reconcile — misspellings, and short forms.
 *
 * Adidas, New Balance, Nike and Puma carry their real marks, as single-path
 * 24x24 glyphs from Simple Icons (the icon data is CC0). The rest fall back to a
 * wordmark until their artwork is added: pass the path data to `svgPath`, or
 * replace the call with the logo's full markup - keep its `viewBox`, drop any
 * fixed `width`/`height`, and use `currentColor` so the tile's hover state
 * drives the colour.
 */
export const BRAND_LOGOS = [
  { name: "Adidas", svg: svgPath("m24 19.535-8.697-15.07-4.659 2.687 7.145 12.383Zm-8.287 0L9.969 9.59 5.31 12.277l4.192 7.258ZM4.658 14.723l2.776 4.812H1.223L0 17.41Z") },
  // Star-chevron only — the supplied file also carries the "CONVERSE" lettering,
  // which the tile already prints beneath the mark. Two subpaths (star, chevron)
  // in one `d`; they don't overlap, so the default nonzero fill is correct.
  {
    name: "Converse",
    svg: svgPath(
      "M 116.46217,118.17609 116.34115,88.299423 144.94578,77.687836 116.13901,68.253349 115.53548,38.816955 98.060775,62.567163 69.475608,53.754706 86.068727,78.686131 69.872309,103.66327 98.08508,94.312856 z m 3.57241,31.40492 51.23552,0 64.21344,-71.014068 -64.52309,-71.1006878 -50.74147,0 60.34684,70.9962818 z",
      "69.476 7.466 166.008 142.115",
    ),
  },
  // Masters data carries the misspelling "crocss", hence the alias.
  { name: "Crocs", aliases: ["crocss"], svg: wordmark("crocs") },
  { name: "New Balance", svg: svgPath("M12.169 10.306l1.111-1.937 3.774-.242.132-.236-3.488-.242.82-1.414h6.47c1.99 0 3.46.715 2.887 2.8-.17.638-.979 2.233-3.356 2.899.507.06 1.76.616 1.54 2.057-.384 2.558-3.69 3.774-5.533 3.774l-7.641.006-.38-1.48 4.005-.28.137-.237-4.346-.264-.467-1.755 6.178-.363.137-.231-11.096-.693.534-.925 11.948-.775.138-.231-3.504-.231m5 .385l1.1-.006c.738-.005 1.502-.34 1.783-1.018.259-.632-.088-1.171-.55-1.166h-1.067l-1.266 2.19zm-1.27 2.195l-1.326 2.305h1.265c.589 0 1.64-.292 1.964-1.128.302-.781-.253-1.177-.638-1.177h-1.266zM6.26 16.445l-.77 1.315L0 17.77l.534-.923 5.726-.402zm.385-10.216l4.417.006.336 1.248-5.276-.33.523-.924zm5 2.245l.484 1.832-7.542-.495.528-.92 6.53-.417zm-3.84 5.281l-.957 1.661-5.32-.302.534-.924 5.743-.435z") },
  { name: "Nike", svg: svgPath("M24 7.8L6.442 15.276c-1.456.616-2.679.925-3.668.925-1.12 0-1.933-.392-2.437-1.177-.317-.504-.41-1.143-.28-1.918.13-.775.476-1.6 1.036-2.478.467-.71 1.232-1.643 2.297-2.8a6.122 6.122 0 00-.784 1.848c-.28 1.195-.028 2.072.756 2.632.373.261.886.392 1.54.392.522 0 1.11-.084 1.764-.252L24 7.8z") },
  // No licensed vector yet — wordmark stands in. Replace with svgPath('<path d>')
  // or paste full markup, per the note above.
  { name: "On Cloud", aliases: ["on", "onrunning"], svg: wordmark("On") },
  // No licensed vector yet — wordmark stands in. Replace with svgPath('<path d>')
  // or paste full markup, per the note above.
  { name: "Onitsuka", aliases: ["onitsukatiger"], svg: wordmark("onitsuka") },
  { name: "Puma", svg: svgPath("M23.845 3.008c-.417-.533-1.146-.106-1.467.08-2.284 1.346-2.621 3.716-3.417 5.077-.626 1.09-1.652 1.89-2.58 1.952-.686.049-1.43-.084-2.168-.405-1.807-.781-2.78-1.792-3.017-1.97-.487-.37-4.23-4.015-7.28-4.164 0 0-.372-.75-.465-.763-.222-.025-.45.451-.616.501-.15.053-.413-.512-.565-.487-.153.02-.302.586-.6.877-.22.213-.486.2-.637.463-.052.096-.034.265-.093.42-.127.32-.551.354-.555.697 0 .381.357.454.669.72.248.212.265.362.554.461.258.088.632-.187.964-.088.277.081.543.14.602.423.054.256 0 .658-.34.613-.112-.015-.598-.174-1.198-.11-.725.077-1.553.309-1.634 1.11-.041.447.514.97 1.055.866.371-.071.196-.506.399-.716.267-.27 1.772.944 3.172.944.593 0 1.031-.15 1.467-.605.04-.029.093-.102.155-.11a.632.632 0 01.195.088c1.131.897 1.984 2.7 6.13 2.721.582.007 1.25.279 1.796.777.48.433.764 1.125 1.037 1.825.418 1.053 1.161 2.069 2.292 3.203.06.068.99.78 1.06.833.012.01.084.167.053.255-.02.69-.123 2.67 1.365 2.753.366.02.275-.231.275-.41-.005-.341-.065-.685.113-1.04.253-.478-.526-.709-.509-1.756.019-.784-.645-.651-.984-1.25-.19-.343-.368-.532-.35-.946.073-2.38-.517-3.948-.805-4.327-.227-.294-.423-.403-.207-.54 1.24-.815 1.525-1.574 1.525-1.574.66-1.541 1.256-2.945 2.075-3.57.166-.12.589-.44.852-.56.763-.362 1.173-.578 1.388-.788.356-.337.635-1.053.294-1.48z") },
  // No licensed vector yet — wordmark stands in. Replace with svgPath('<path d>')
  // or paste full markup, per the note above.
  { name: "Timberland", svg: wordmark("Timberland") },
] as const;

/**
 * Wrap glyph path data in a tile-ready SVG. The default box suits Simple Icons'
 * 24x24 glyphs; pass `viewBox` when inlining a logo drawn on its own canvas,
 * set to the mark's real bounding box so the tile centres it without slack.
 */
function svgPath(d: string, viewBox = '0 0 24 24'): string {
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="presentation"><path d="${d}" fill="currentColor"/></svg>`;
}

/**
 * Stand-in mark for a brand whose vector we don't have: its name set in the
 * storefront's own type. Closer to the real thing than initials would be, since
 * most of these brands' logos are wordmarks anyway.
 *
 * The viewBox widens with the text so the glyphs keep a constant aspect; the
 * tile renders it `object-contain`, which then scales a long name like
 * "Timberland" down and a short one like "On" up to fill the same circle.
 */
function wordmark(text: string): string {
  const width = Math.max(24, text.length * 11);
  return `<svg viewBox="0 0 ${width} 24" xmlns="http://www.w3.org/2000/svg" role="presentation"><text x="${width / 2}" y="12" text-anchor="middle" dominant-baseline="central" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="15" font-weight="800" letter-spacing="-0.6" fill="currentColor">${text}</text></svg>`;
}

/** Lowercase and strip everything but a-z/0-9, so "New Balance" -> "newbalance". */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The brand's SVG markup, or `undefined` when it isn't in {@link BRAND_LOGOS} -
 * callers fall back to the initials tile, so an unmapped brand still shows up.
 */
export function brandLogoSvg(name: string): string | undefined {
  const key = normalize(name);
  return BRAND_LOGOS.find(
    (brand) =>
      normalize(brand.name) === key ||
      ('aliases' in brand && brand.aliases.some((alias) => normalize(alias) === key)),
  )?.svg;
}

/** Up to two letters for the fallback tile, e.g. "New Balance" -> "NB". */
export function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`.toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}
