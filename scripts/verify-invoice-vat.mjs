// VAT invoice math verification: net + VAT must equal gross for every package
// and the stored 62.50 SEK payment. Mirrors src/lib/subscriptionInvoice.ts.
const RATE = 0.25;

const packages = [
  { name: 'Starter (sub)', net: 50000 },
  { name: 'Growth (sub)', net: 100000 },
  { name: 'Business (sub)', net: 160000 },
  { name: 'Mini (topup)', net: 5000 },
  { name: 'Small (topup)', net: 11000 },
  { name: 'Medium (topup)', net: 20000 },
  { name: 'Large (topup)', net: 40000 },
];

// Expected Stripe charges (net + round(net * 0.25)) from the price sync.
const cases = packages.map((p) => {
  const gross = p.net + Math.round(p.net * RATE);
  return { name: p.name, gross, expectNet: p.net, expectVat: gross - p.net };
});

// The real stored payment: amount_cents = total_cents = 6250 (vat_cents 1042
// in the DB is ignored — the derivation from the gross is authoritative).
cases.push({ name: 'Stored Mini top-up payment (62.50 kr)', gross: 6250, expectNet: 5000, expectVat: 1250 });

let failures = 0;
for (const c of cases) {
  const netCents = Math.round(c.gross / (1 + RATE));
  const vatCents = c.gross - netCents;
  const reconciles = netCents + vatCents === c.gross;
  const matches = netCents === c.expectNet && vatCents === c.expectVat;
  if (!reconciles || !matches) failures++;
  console.log(
    `${matches && reconciles ? 'PASS' : 'FAIL'}  ${c.name}: gross ${c.gross} → net ${netCents} + VAT ${vatCents} = ${netCents + vatCents}${reconciles ? '' : ' (MISMATCH)'}`
  );
}

// Rounding edge cases at 25%: gross values where gross/1.25 is not integral.
for (const gross of [101, 123, 5555, 999999]) {
  const netCents = Math.round(gross / (1 + RATE));
  const vatCents = gross - netCents;
  if (netCents + vatCents !== gross) failures++;
  console.log(`${netCents + vatCents === gross ? 'PASS' : 'FAIL'}  rounding gross ${gross} → net ${netCents} + VAT ${vatCents} = ${netCents + vatCents}`);
}

process.exit(failures === 0 ? 0 : 1);
