'use client';

import { LegalPage } from '@/components/legal-page';
import { business } from '@/lib/business';

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Refund &"
      titleAccent="cancellation."
      intro="This policy covers order cancellations, returns, and how refunds are processed. It should be read together with our Shipping & returns page, which covers the full return process."
      lastUpdated="15 October 2026"
      sections={[
        {
          heading: 'Order cancellation',
          bullets: [
            'You can cancel an order free of charge any time before it has been dispatched — contact us on WhatsApp or email with your order ID.',
            'Once an order has been dispatched, it can no longer be cancelled; you may still raise a return/exchange request after delivery, as described below and on our Shipping & returns page.',
          ],
        },
        {
          heading: 'Return window',
          body: [
            'Report any damaged, defective, incorrect, or missing items within 2 days of delivery. Returns raised after this window will not be accepted.',
            'A continuous, unedited unboxing video of the package and product is required to raise a valid claim.',
          ],
        },
        {
          heading: 'Refund timeline and mode',
          bullets: [
            'Once we receive and inspect the returned item, we will confirm whether a refund or exchange applies.',
            'Approved refunds are processed to the original payment method within 7–10 business days of inspection; your bank or payment provider may take a few additional days to reflect the credit.',
            'Return & exchange courier charges are to be borne by the customer. The original shipping fee (if any) is non-refundable.',
          ],
        },
        {
          heading: 'Non-returnable cases',
          bullets: [
            'Items that are worn, used, or damaged after delivery, or returned without the original box, tags, and accessories.',
            'Claims raised without a continuous, unedited unboxing video.',
            'Claims raised after the 2-day reporting window.',
          ],
        },
        {
          heading: 'How to raise a request',
          bullets: [
            'Message us on WhatsApp or email with your order ID and your unboxing video.',
            'Repack the item in its original box with tags and accessories intact.',
            'Ship it back to us — once inspected, we process your refund or exchange.',
          ],
        },
        {
          heading: 'Contact',
          body: [
            `For cancellations, returns, or refund queries, contact ${business.name} at ${business.email}.`,
          ],
        },
      ]}
    />
  );
}
