export type TermsBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'sub'; text: string };

export interface TermsSection {
  title: string;
  blocks: TermsBlock[];
}

export const TERMS_LAST_UPDATED = '2 November 2026';

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: 'Introduction',
    blocks: [
      { type: 'p', text: 'Welcome to Virgo Portals.' },
      {
        type: 'p',
        text: 'Virgo Portals provides a digital ordering platform that allows visitors to browse participating restaurants\u2019 menus, interact with digital menu assistants where available, select food and beverages, and submit orders to restaurants.',
      },
      {
        type: 'p',
        text: 'By placing an order through Virgo Portals, you acknowledge and agree to these Restaurant Ordering Terms & Conditions.',
      },
      {
        type: 'p',
        text: 'These terms explain the relationship between the visitor, Virgo Portals and the restaurant fulfilling the order.',
      },
    ],
  },
  {
    title: 'Role of Virgo Portals',
    blocks: [
      {
        type: 'p',
        text: 'Virgo Portals provides the digital technology used to display restaurant menus and transmit customer orders to participating restaurants.',
      },
      {
        type: 'p',
        text: 'Virgo Portals acts as an ordering platform and does not itself prepare, cook, package or serve food.',
      },
      {
        type: 'p',
        text: 'The restaurant is responsible for its menu, food preparation, ingredients, food quality, food safety, order fulfilment and customer service relating to the food and beverages supplied.',
      },
      {
        type: 'p',
        text: 'The restaurant\u2019s identity and contact details should be displayed wherever available in the ordering experience.',
      },
    ],
  },
  {
    title: 'Placing an Order',
    blocks: [
      {
        type: 'p',
        text: 'Customers can browse the available menu, select items, choose available serving options, specify permitted customisations and add items to their basket.',
      },
      { type: 'p', text: 'Before submitting an order, customers should review:' },
      {
        type: 'list',
        items: [
          'Selected food and beverages.',
          'Quantities and serving sizes.',
          'Selected customisations and removed ingredients.',
          'Additional requests.',
          'Applicable prices and any displayed tip.',
          'Total order amount.',
          'Selected payment method.',
        ],
      },
      {
        type: 'p',
        text: 'Submitting an order sends it to the restaurant for processing.',
      },
      {
        type: 'p',
        text: 'Submission does not necessarily mean that the restaurant has accepted the order. Orders remain subject to restaurant availability, operating hours and capacity.',
      },
      {
        type: 'p',
        text: 'If the restaurant cannot fulfil an order, it should communicate this to the customer and handle any payment or refund obligations in accordance with applicable law.',
      },
    ],
  },
  {
    title: 'Menu, Prices and Availability',
    blocks: [
      {
        type: 'p',
        text: 'Menus, descriptions, photographs, prices and availability are provided by the participating restaurant.',
      },
      {
        type: 'p',
        text: 'The restaurant is responsible for ensuring that its menu information and prices are accurate and up to date.',
      },
      {
        type: 'p',
        text: 'Menu photographs are illustrative and the actual appearance or presentation of an item may differ.',
      },
      {
        type: 'p',
        text: 'An item may become unavailable due to stock limitations or restaurant operating conditions.',
      },
      {
        type: 'p',
        text: 'The customer will be informed of material changes or unavailability where applicable.',
      },
      {
        type: 'p',
        text: 'The displayed order total should be reviewed before submission.',
      },
    ],
  },
  {
    title: 'Customisations and Additional Requests',
    blocks: [
      {
        type: 'p',
        text: 'Where available, customers may select serving options, remove ingredients, select add-ons or submit additional preparation requests.',
      },
      {
        type: 'p',
        text: 'The restaurant will make reasonable efforts to follow the selected customisations.',
      },
      {
        type: 'p',
        text: 'However, an additional request is not automatically guaranteed. If the restaurant cannot fulfil a request, it should communicate this to the customer where reasonably possible.',
      },
      {
        type: 'p',
        text: 'Customers should contact the restaurant directly when a particular dietary requirement is essential.',
      },
    ],
  },
  {
    title: 'Allergens and Dietary Requirements',
    blocks: [
      {
        type: 'p',
        text: 'Customers with food allergies, intolerances or specific dietary requirements should contact the restaurant directly before placing an order if they need clarification.',
      },
      {
        type: 'p',
        text: 'Although customers may remove ingredients or submit special requests through the ordering platform, this does not guarantee that an item is free from a particular allergen.',
      },
      {
        type: 'p',
        text: 'Cross-contact may occur during food preparation, handling or storage.',
      },
      {
        type: 'p',
        text: 'The restaurant is responsible for providing accurate allergen information and handling food in accordance with applicable food safety requirements.',
      },
      {
        type: 'p',
        text: 'Virgo Portals does not independently verify the ingredients or allergen status of restaurant menu items.',
      },
    ],
  },
  {
    title: 'Payment Methods',
    blocks: [
      { type: 'p', text: 'The available payment methods are displayed during Checkout.' },
      { type: 'sub', text: 'Pay to Staff' },
      {
        type: 'p',
        text: 'When this option is selected, the order is transmitted to the restaurant.',
      },
      {
        type: 'p',
        text: 'The customer pays the restaurant staff directly, according to the restaurant\u2019s arrangements, such as at the table or counter.',
      },
      {
        type: 'p',
        text: 'Submitting an order using Pay to Staff does not mean that an online payment has been processed.',
      },
      { type: 'sub', text: 'Pay Online' },
      {
        type: 'p',
        text: 'When this option is selected, the customer follows the online payment flow presented by the platform.',
      },
      {
        type: 'p',
        text: 'The actual payment functionality and payment status depend on the payment service integrated into the ordering experience.',
      },
      {
        type: 'p',
        text: 'Where test-payment functionality is used, it must be clearly distinguished from a real payment. Test payments do not charge the customer.',
      },
      { type: 'sub', text: 'Tips' },
      {
        type: 'p',
        text: 'Where available, customers may voluntarily select a tip during Checkout.',
      },
      {
        type: 'p',
        text: 'Any selected tip should be displayed separately from the food and beverage subtotal and included transparently in the displayed total.',
      },
    ],
  },
  {
    title: 'Order Preparation and Fulfilment',
    blocks: [
      {
        type: 'p',
        text: 'The restaurant is responsible for preparing and fulfilling accepted orders.',
      },
      {
        type: 'p',
        text: 'Estimated preparation times, where displayed, are estimates and may change depending on restaurant activity, availability and other operating conditions.',
      },
      {
        type: 'p',
        text: 'Customers should follow the restaurant\u2019s instructions for collection or table service.',
      },
      {
        type: 'p',
        text: 'Virgo Portals transmits order information but does not control the restaurant\u2019s preparation or fulfilment operations.',
      },
    ],
  },
  {
    title: 'Cancellation, Incorrect Orders and Refunds',
    blocks: [
      {
        type: 'p',
        text: 'Customers should contact the restaurant as soon as possible if they need to report an incorrect order, request cancellation or raise an issue concerning food preparation or fulfilment.',
      },
      {
        type: 'p',
        text: 'Whether an order can be cancelled depends on its status, preparation progress and applicable consumer rights.',
      },
      {
        type: 'p',
        text: 'Where a payment has been made, refunds and payment corrections must be handled in accordance with applicable law and the responsibilities of the relevant seller and payment provider.',
      },
      {
        type: 'p',
        text: 'Nothing in these terms removes or restricts any mandatory consumer rights.',
      },
    ],
  },
  {
    title: 'Customer Contact Information',
    blocks: [
      {
        type: 'p',
        text: 'A mobile number may be required during Checkout so the restaurant can contact the customer regarding the order.',
      },
      {
        type: 'p',
        text: 'Customer contact information must be handled in accordance with the applicable Privacy Policy and data protection legislation.',
      },
      { type: 'p', text: 'The Privacy Policy should explain:' },
      {
        type: 'list',
        items: [
          'What personal information is collected.',
          'Why it is collected.',
          'How it is used.',
          'Who may receive it.',
          'How long it is retained.',
          'The customer\u2019s applicable data protection rights.',
          'How customers can contact the relevant data controller.',
        ],
      },
      {
        type: 'p',
        text: 'Agreeing to these Terms & Conditions does not by itself constitute consent to all personal data processing.',
      },
    ],
  },
  {
    title: 'Complaints and Customer Support',
    blocks: [
      {
        type: 'p',
        text: 'For issues concerning food, ingredients, allergens, preparation, collection, order accuracy or restaurant service, customers should contact the restaurant responsible for fulfilling the order.',
      },
      {
        type: 'p',
        text: 'For technical issues concerning the Virgo Portals ordering platform, customers may contact the platform operator through its published support contact details.',
      },
    ],
  },
  {
    title: 'Applicable Law and Consumer Rights',
    blocks: [
      {
        type: 'p',
        text: 'These terms are intended to operate in accordance with applicable Swedish and European Union consumer protection legislation.',
      },
      {
        type: 'p',
        text: 'Nothing in these terms excludes, limits or removes mandatory rights that customers have under applicable law.',
      },
      {
        type: 'p',
        text: 'Any disputes concerning food, restaurant services or order fulfilment should be directed to the responsible restaurant, without prejudice to the customer\u2019s statutory rights.',
      },
    ],
  },
  {
    title: 'Changes to These Terms',
    blocks: [
      {
        type: 'p',
        text: 'These Terms & Conditions may be updated when necessary.',
      },
      {
        type: 'p',
        text: 'The latest version should be made available through the ordering experience.',
      },
    ],
  },
];
