export type TermsBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'sub'; text: string };

export interface TermsSection {
  title: string;
  blocks: TermsBlock[];
}

export const TERMS_LAST_UPDATED = '21 November 2026';

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: 'Introduction',
    blocks: [
      { type: 'p', text: 'Welcome to Virgo Portals.' },
      {
        type: 'p',
        text: 'Virgo Portals provides a digital ordering platform for visitors at participating restaurants and hotels. Visitors can browse menus, use digital menu assistants where available, select food and beverages, and submit orders through the platform.',
      },
      {
        type: 'p',
        text: 'By placing an order through Virgo Portals, you acknowledge and agree to these Restaurant Ordering Terms & Conditions.',
      },
      {
        type: 'p',
        text: 'These terms explain the role of Virgo Portals and the responsibilities relevant to your order.',
      },
    ],
  },
  {
    title: 'Platform Operator',
    blocks: [
      { type: 'p', text: 'Virgo Portals is operated by Virgo Imagination.' },
      { type: 'p', text: 'Address: Södergatan 53, 19547 Märsta, Sweden.' },
      { type: 'p', text: 'Website: https://virgoimagination.com/' },
      { type: 'p', text: 'Email: contact@virgoimagination.com' },
    ],
  },
  {
    title: 'Role of Virgo Portals',
    blocks: [
      {
        type: 'p',
        text: 'Virgo Portals presents the digital menu, receives the visitor’s order and forwards the order information to the restaurant or hotel through its system.',
      },
      {
        type: 'p',
        text: 'Virgo Portals does not prepare food or beverages, control their quality, deliver or serve them, manage the restaurant’s or hotel’s operational workflow, replace its POS system, or generate its bill or invoice.',
      },
      {
        type: 'p',
        text: 'Food preparation, quality, service, fulfilment and billing are the responsibility of the restaurant or hotel.',
      },
    ],
  },
  {
    title: 'Placing and Acceptance of an Order',
    blocks: [
      {
        type: 'p',
        text: 'Visitors can browse the available menu, select items, choose available serving options, specify permitted customisations and add items to their basket.',
      },
      { type: 'p', text: 'Before submitting an order, please review:' },
      {
        type: 'list',
        items: [
          'Selected food and beverages.',
          'Quantities and serving options.',
          'Selected customisations, variants and add-ons.',
          'Additional requests.',
          'Applicable prices and any displayed service charges or tip.',
          'Total order amount.',
          'Selected payment method.',
        ],
      },
      {
        type: 'p',
        text: 'Submitting an order sends it to the restaurant or hotel. Submission alone does not mean that the order has been accepted.',
      },
      {
        type: 'p',
        text: 'An order is accepted only when the restaurant or hotel has received it in its own system and accepts it.',
      },
    ],
  },
  {
    title: 'Menu, Prices and Availability',
    blocks: [
      {
        type: 'p',
        text: 'The restaurant or hotel is fully responsible for the information it provides or manages in its menu, including item names and descriptions, prices, additional charges, availability, ingredients, composition and allergen information.',
      },
      {
        type: 'p',
        text: 'Virgo Portals displays the menu information supplied or managed by the restaurant or hotel and does not independently verify its accuracy or completeness.',
      },
      {
        type: 'p',
        text: 'Visitors should contact restaurant or hotel staff directly if they need clarification about a menu item, its ingredients or allergens.',
      },
    ],
  },
  {
    title: 'Customisations and Additional Requests',
    blocks: [
      {
        type: 'p',
        text: 'Where available, visitors may select serving options, variants, add-ons, remove ingredients or submit additional requests through the ordering experience.',
      },
      {
        type: 'p',
        text: 'The restaurant or hotel is responsible for reviewing and handling the selected customisations and requests when preparing the order.',
      },
      {
        type: 'p',
        text: 'Visitors should speak directly with restaurant or hotel staff if a particular dietary requirement or request is essential.',
      },
    ],
  },
  {
    title: 'Allergens and Dietary Requirements',
    blocks: [
      {
        type: 'p',
        text: 'Visitors with food allergies, intolerances or specific dietary requirements should contact restaurant or hotel staff directly before ordering if they need clarification.',
      },
      {
        type: 'p',
        text: 'Removing an ingredient or submitting a special request through the platform does not guarantee that an item is free from a particular allergen. Cross-contact may occur during food preparation, handling or storage.',
      },
      {
        type: 'p',
        text: 'The restaurant or hotel is responsible for the accuracy of allergen information and for food preparation and handling in accordance with applicable requirements.',
      },
      {
        type: 'p',
        text: 'Virgo Portals does not independently verify the ingredients, composition or allergen status of menu items.',
      },
    ],
  },
  {
    title: 'Alcohol Age Declaration',
    blocks: [
      {
        type: 'p',
        text: 'Where the ordering experience displays an age declaration for alcoholic beverages, visitors may be asked to confirm that they meet the legal age requirement applicable to the purchase or consumption of alcohol.',
      },
      {
        type: 'p',
        text: 'This is a self-declaration only. Virgo Portals does not authenticate a visitor’s age or verify identity documents. The declaration is not proof of age and does not replace any age or ID check required from restaurant or hotel staff.',
      },
      {
        type: 'p',
        text: 'The restaurant or hotel is responsible for carrying out any required age and ID checks and for following its own alcohol-serving procedures and applicable requirements.',
      },
    ],
  },
  {
    title: 'Payment Methods',
    blocks: [
      { type: 'p', text: 'The payment methods available to the visitor are displayed during Checkout.' },
      { type: 'sub', text: 'Pay to Staff' },
      {
        type: 'p',
        text: 'Pay to Staff represents the restaurant’s or hotel’s own payment arrangement. The visitor places the order through Virgo Portals and pays the restaurant or hotel directly. The restaurant or hotel determines how its staff collects the payment, for example at the table or at the counter.',
      },
      {
        type: 'p',
        text: 'Virgo Portals does not collect, process or handle payments made directly to restaurant or hotel staff.',
      },
      { type: 'sub', text: 'Pay Online' },
      {
        type: 'p',
        text: 'When Pay Online is available and selected, the visitor follows the online payment flow presented during Checkout. The payment result or status is displayed as part of the ordering experience.',
      },
      { type: 'sub', text: 'Tips' },
      {
        type: 'p',
        text: 'Tips are optional. Visitors may choose to add a tip or select “No Tip”. A tip is not required to place an order.',
      },
    ],
  },
  {
    title: 'Serving and Order Fulfilment',
    blocks: [
      {
        type: 'p',
        text: 'The restaurant or hotel determines how an accepted order is served or handed over, including table service or collection at the counter, according to its own service arrangements.',
      },
      {
        type: 'p',
        text: 'The restaurant or hotel is responsible for preparing and fulfilling accepted orders and for its service to the visitor. Virgo Portals does not control these operational activities.',
      },
    ],
  },
  {
    title: 'Refunds and Payment Issues',
    blocks: [
      {
        type: 'p',
        text: 'If an order has been accepted by the restaurant or hotel and a refund is required, the restaurant or hotel is responsible for handling the refund through its usual payment and refund process.',
      },
      {
        type: 'p',
        text: 'For a payment that appears pending, unsuccessful or duplicated, the restaurant or hotel may investigate the payment status for the relevant order in its own system. The contact number provided with the order may be used by the restaurant or hotel to contact the visitor in accordance with its own policies.',
      },
      {
        type: 'p',
        text: 'If a payment issue does not resolve automatically and investigation by Virgo Portals is needed, please allow up to 48 hours for the investigation. If the issue is on the Virgo Portals side, Virgo Portals guarantees that its investigation and applicable resolution process will be completed within 48 hours.',
      },
      {
        type: 'p',
        text: 'The 48-hour period relates to investigation and resolution of an issue on the Virgo Portals side. It is not a guarantee that refunded funds will be credited to a visitor’s bank account within 48 hours.',
      },
      {
        type: 'p',
        text: 'Virgo Portals is not responsible for processing times or delays caused by a visitor’s bank or other bank-side processes.',
      },
    ],
  },
  {
    title: 'Customer Contact Information',
    blocks: [
      {
        type: 'p',
        text: 'A mobile number, including its country calling code, is required to place an order. The number is provided with the order so the restaurant or hotel can contact the visitor about it.',
      },
      {
        type: 'p',
        text: 'Virgo Portals does not authenticate or independently verify the mobile number and does not guarantee that the number is genuine or reachable.',
      },
    ],
  },
  {
    title: 'Guest Data and Data Rights',
    blocks: [
      {
        type: 'p',
        text: 'Virgo Portals independently stores visitor information and visitor order records for at least one year. These records are held by Virgo Portals and are not dependent on or connected to the restaurant’s or hotel’s internal database.',
      },
      {
        type: 'p',
        text: 'Visitors may contact Virgo Portals to request access to, correction of or deletion of their personal information. Requests will be processed within up to seven days of receipt, subject to applicable law and any lawful requirements to retain information.',
      },
      {
        type: 'p',
        text: 'This processing period does not limit or replace any rights or response deadlines that apply under the General Data Protection Regulation (GDPR) or other applicable data protection law.',
      },
      { type: 'p', text: 'For data-related requests, contact: contact@virgoimagination.com.' },
    ],
  },
  {
    title: 'Complaints and Customer Support',
    blocks: [
      {
        type: 'p',
        text: 'Complaints about food preparation, food quality, serving, missing items, incorrect items or customisations should be raised directly with the restaurant or hotel staff. The restaurant or hotel is responsible for checking the issue and deciding how to correct or otherwise handle it.',
      },
      {
        type: 'p',
        text: 'If a technical error in Virgo Portals causes the order information received by the restaurant or hotel to differ from the order submitted by the visitor, this is a platform technical issue. Visitors may contact Virgo Portals at contact@virgoimagination.com.',
      },
    ],
  },
  {
    title: 'Applicable Law and Consumer Rights',
    blocks: [
      {
        type: 'p',
        text: 'These Terms and Conditions are governed by Swedish law. Your mandatory consumer rights under applicable law remain unaffected.',
      },
    ],
  },
  {
    title: 'Changes to These Terms',
    blocks: [
      {
        type: 'p',
        text: 'Virgo Portals may update these Terms and Conditions from time to time. The latest version will be made available on this page.',
      },
    ],
  },
];
