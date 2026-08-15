import { GoogleAnalytics } from '@next/third-parties/google';

export default function GoogleAnalyticsWrapper() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  if (!gaId) {
    return null;
  }

  return <GoogleAnalytics gaId={gaId} />;
}
