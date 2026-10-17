'use client';

import { LegalPage } from '@/components/legal-page';
import { business } from '@/lib/business';

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy"
      titleAccent="policy."
      intro="This policy explains what information Prime Kicks collects when you use this site, how we use it, and the choices you have."
      lastUpdated="15 October 2026"
      sections={[
        {
          heading: 'Information we collect',
          body: [
            'We collect information you give us directly — such as your name, email address, phone number, and delivery address — when you create an account, place an order, or contact us.',
            'We also collect limited technical information automatically, such as your device/browser type, IP address, and pages visited, to help us operate and secure the site.',
          ],
          bullets: [
            'Account details: name, email, phone number, password (stored securely, never in plain text).',
            'Order details: items purchased, shipping address, order history.',
            'Payment details: we do not store your card, UPI, or net-banking details — these are collected and processed directly by our payment gateway partner.',
            'Usage data: pages viewed, device and browser information, approximate location derived from IP address.',
          ],
        },
        {
          heading: 'How we use your information',
          bullets: [
            'To process and deliver your orders, and to communicate order status and updates.',
            'To provide customer support and respond to queries or complaints.',
            'To improve our website, product catalogue, and overall shopping experience.',
            'To send order-related notifications and, where you have opted in, updates about new arrivals or offers.',
            'To detect, prevent, and address fraud, abuse, or security issues.',
          ],
        },
        {
          heading: 'Cookies',
          body: [
            'We use cookies and similar technologies to keep you signed in, remember items in your bag, and understand how the site is used (basic analytics). You can control or disable cookies from your browser settings; some features may not work as intended if cookies are disabled.',
          ],
        },
        {
          heading: 'Third parties we share information with',
          body: [
            'We share only the information necessary for these partners to perform their function, and only for that purpose:',
          ],
          bullets: [
            'Payment gateway (e.g. Cashfree/Razorpay) — to securely process your payment. We never see or store your full payment credentials.',
            'Shipping and logistics partners — to deliver your order and provide tracking.',
            'Analytics providers — to understand aggregate site usage (e.g. Google Analytics).',
            'Law enforcement or regulators, where required by law.',
          ],
        },
        {
          heading: 'Data retention',
          body: [
            'We retain your account and order information for as long as your account is active, or as needed to comply with our legal, accounting, and tax obligations (including GST record-keeping requirements under Indian law). You may request deletion of your account data at any time, subject to these legal retention requirements.',
          ],
        },
        {
          heading: 'Your rights',
          bullets: [
            'Access the personal information we hold about you.',
            'Request correction of inaccurate or incomplete information.',
            'Request deletion of your account and associated data, subject to legal retention requirements.',
            'Withdraw consent for marketing communications at any time.',
          ],
        },
        {
          heading: 'Grievance officer / contact us',
          body: [
            `For any privacy-related questions, requests, or grievances, please contact us: ${business.name}, ${business.address}. Email: ${business.email}.`,
            'We aim to acknowledge and resolve grievances as promptly as possible, in line with applicable Indian data-protection law.',
          ],
        },
      ]}
    />
  );
}
