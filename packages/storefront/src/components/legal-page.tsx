'use client';

import { Announcement } from '@/components/announcement';
import { FadeSection } from '@/components/fade-section';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

export type LegalSection = {
  heading: string;
  /** Paragraphs of body copy. */
  body?: React.ReactNode[];
  /** Optional bullet list rendered below the paragraphs. */
  bullets?: React.ReactNode[];
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-[11px] text-[13.5px] leading-[1.6] text-[#555]">
      <span className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}

/**
 * Shared layout for the compliance / policy pages (privacy, terms, refund).
 * Mirrors the shipping-returns page: Announcement + header, a left-aligned
 * hero, then fade-in content sections, then the site footer.
 */
export function LegalPage({
  eyebrow = 'Legal',
  title,
  titleAccent,
  intro,
  lastUpdated,
  sections,
}: {
  eyebrow?: string;
  /** Leading, upright part of the H1. */
  title: string;
  /** Trailing, italic-serif part of the H1. */
  titleAccent: string;
  intro: React.ReactNode;
  lastUpdated: string;
  sections: LegalSection[];
}) {
  return (
    <main>
      <Announcement />
      <SiteHeader />

      {/* Hero */}
      <section className="max-w-[1180px] mx-auto px-[5.25vw] pt-[70px] pb-[36px] max-[800px]:pt-[46px] max-[800px]:px-[21px]">
        <p className="m-0 mb-[13px] text-[10px] font-bold uppercase tracking-[.18em] text-accent">
          {eyebrow}
        </p>
        <h1 className="m-0 text-[clamp(46px,6.4vw,88px)] leading-[.84] tracking-[-.09em] max-[800px]:text-[52px]">
          {title} <em className="font-[Georgia,serif] font-normal">{titleAccent}</em>
        </h1>
        <p className="mt-[24px] max-w-[620px] text-[15px] leading-[1.7] text-[#555]">{intro}</p>
        <p className="mt-[16px] text-[11px] uppercase tracking-[.08em] text-[#8a8a8a]">
          Last updated: {lastUpdated}
        </p>
      </section>

      {/* Sections */}
      <FadeSection className="max-w-[760px] mx-auto px-[5.25vw] pb-[80px] grid gap-[34px] max-[800px]:px-[21px] max-[800px]:pb-[60px]">
        {sections.map((section) => (
          <article key={section.heading}>
            <h2 className="m-0 mb-[14px] text-[clamp(20px,2.4vw,26px)] tracking-[-.05em]">
              {section.heading}
            </h2>
            {section.body?.map((paragraph, i) => (
              <p
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className="m-0 mb-[12px] text-[13.5px] leading-[1.7] text-[#555]"
              >
                {paragraph}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 && (
              <ul className="mt-[6px] grid gap-[11px] list-none p-0 m-0">
                {section.bullets.map((bullet, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Bullet key={i}>{bullet}</Bullet>
                ))}
              </ul>
            )}
          </article>
        ))}
      </FadeSection>

      <SiteFooter />
    </main>
  );
}
