'use client';

import { LegalPage } from '@/components/legal-page';
import { business } from '@/lib/business';

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms &"
      titleAccent="conditions."
      intro="These terms govern your use of this website and any purchase you make from us. By placing an order, you agree to these terms."
      lastUpdated="15 October 2026"
      sections={[
        {
          heading: 'Eligibility',
          body: [
            'You must be at least 18 years old, or be placing an order under the supervision of a parent or guardian, to purchase from this site. By placing an order, you confirm that the information you provide is accurate and that you are authorised to use the payment method provided.',
          ],
        },
        {
          heading: 'Orders',
          bullets: [
            'All orders are subject to acceptance and availability. We may cancel or refuse any order at our discretion, including in cases of suspected fraud, pricing errors, or stock unavailability — in which case any amount paid will be refunded.',
            'An order is confirmed only once payment is successfully processed and you receive an order confirmation.',
            'For made-to-request or "request a pair" items, your order is confirmed only after we verify availability and you complete payment — see the product page for details.',
          ],
        },
        {
          heading: 'Pricing',
          body: [
            'All prices listed on this site are in Indian Rupees (₹ / INR) and are inclusive of applicable taxes unless stated otherwise. Shipping charges, where applicable, are shown separately at checkout — see our Shipping & returns page for details.',
            'We reserve the right to change prices at any time; the price charged is the price displayed at the time your order is placed.',
          ],
        },
        {
          heading: 'Payment',
          body: [
            'Payments are processed through our third-party payment gateway partner. We do not store your card, UPI, or net-banking credentials — these are handled directly by the payment gateway in accordance with its own security standards and terms.',
          ],
        },
        {
          heading: 'Product authenticity',
          body: [
            `Products listed on this site are sourced from ${business.sourcing}. We provide an invoice with every order. If you have questions about a specific product's sourcing, please contact us before purchase.`,
          ],
        },
        {
          heading: 'Limitation of liability',
          body: [
            'To the maximum extent permitted by applicable law, Prime Kicks and its owners/operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of this site or any product purchased through it. Our total liability for any claim relating to an order is limited to the amount paid for that order.',
          ],
        },
        {
          heading: 'Governing law & jurisdiction',
          body: [
            'These terms are governed by the laws of India. Any disputes arising out of or in connection with these terms or your use of this site shall be subject to the exclusive jurisdiction of the courts located at the city where our business is registered.',
          ],
        },
        {
          heading: 'Contact',
          body: [
            `${business.name}, ${business.address}. Email: ${business.email}.`,
          ],
        },
      ]}
    />
  );
}
