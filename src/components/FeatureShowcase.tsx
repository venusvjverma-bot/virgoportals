interface Feature {
  title: string;
  description: string;
  icon: string;
}

const FEATURES: Feature[] = [
  {
    title: 'Supabase Database Infrastructure',
    description:
      'Structured PostgreSQL database architecture for restaurant, Host, menu and order data, with relational structures and controlled database access.',
    icon: '/feature-icons/database.webp',
  },
  {
    title: 'LLM Integration & AI Orchestration',
    description:
      'Integration with external Large Language Models for visitor conversations and menu interpretation, connecting AI capabilities to platform workflows.',
    icon: '/feature-icons/ai-orchestration.webp',
  },
  {
    title: 'Supabase Cloud Backend',
    description:
      'Cloud-based backend services supporting authentication, database operations, server-side functions and communication between platform components.',
    icon: '/feature-icons/cloud-backend.webp',
  },
  {
    title: 'Serverless API & Edge Functions',
    description:
      'Backend processing through Supabase Edge Functions for AI requests, menu extraction, order processing and external service communication.',
    icon: '/feature-icons/edge-functions.webp',
  },
  {
    title: 'Authentication & Access Control',
    description:
      'Role-based Admin and Host access, authenticated sessions and database-level access policies designed to protect restaurant data and operations.',
    icon: '/feature-icons/access-control.webp',
  },
  {
    title: 'Real-Time Data Synchronization',
    description:
      'Live order updates and database-driven communication keep restaurant order information synchronized between visitor and Host interfaces.',
    icon: '/feature-icons/realtime-sync.webp',
  },
  {
    title: 'LLM Token & Credit Management',
    description:
      'Centralized AI usage metering with token accounting, Host credit allocation and automatic service access control based on available credits.',
    icon: '/feature-icons/token-credits.webp',
  },
  {
    title: 'Multi-Tenant Architecture',
    description:
      'Separate restaurant environments operating through shared platform infrastructure, with Host-specific data association and access boundaries.',
    icon: '/feature-icons/multi-tenant.webp',
  },
];

export function FeatureShowcase() {
  return (
    <section aria-labelledby="platform-features-heading" className="mt-12">
      <h2
        id="platform-features-heading"
        className="text-center font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
      >
        How Virgo Portals works
      </h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            className="group flex gap-5 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-cream-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-lift"
          >
            <img
              src={feature.icon}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="h-20 w-20 flex-shrink-0 object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-snug text-ink">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
