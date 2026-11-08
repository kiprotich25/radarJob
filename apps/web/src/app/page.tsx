import { ArrowRight, ScanSearch } from 'lucide-react';
import Link from 'next/link';
import { GUIDES } from '@radarjob/shared';
import { EducationCard } from '@/components/education-card';
import { HeroAnalyzer } from '@/components/hero-analyzer';
import { RadarMark } from '@/components/radar-mark';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const STEPS = [
  {
    title: 'Paste the link',
    body: 'Copy the job link from WhatsApp, SMS, email or a job board. RadarJob never opens it in your browser.',
  },
  {
    title: 'We gather evidence',
    body: 'Security-vendor reputation, domain registration, link structure and — where enabled — a safe look at the page.',
  },
  {
    title: 'Rules weigh the evidence',
    body: 'A fixed, tested set of rules decides the assessment. AI can add observations but cannot change the outcome.',
  },
  {
    title: 'You get a plain-language report',
    body: 'What we found, why it matters, what we could not check, and what to do next.',
  },
];

const PATTERNS = [
  {
    title: 'Pay to apply',
    body: 'Registration, interview, training or "processing" fees before you are hired.',
    slug: 'recruitment-fee-scams',
  },
  {
    title: 'Look-alike career sites',
    body: "A real company name placed in front of someone else's domain.",
    slug: 'phishing-links-fake-career-sites',
  },
  {
    title: 'Chat-only recruiters',
    body: 'Hiring that happens entirely on WhatsApp or Telegram, often with "tasks".',
    slug: 'whatsapp-telegram-recruitment-scams',
  },
  {
    title: 'Codes and PINs',
    body: 'Requests for one-time codes, M-PESA PINs or passwords "to verify you".',
    slug: 'identity-theft-sensitive-information',
  },
  {
    title: 'Move money for us',
    body: '"Payment processing" jobs that route stolen money through your account.',
    slug: 'money-mule-recruitment',
  },
  {
    title: 'Act now, tell no one',
    body: 'Deadlines in minutes and requests for secrecy that stop you from checking.',
    slug: 'social-engineering-urgency',
  },
];

const CHECKS = [
  [
    'URL reputation',
    'Verdicts from dozens of security vendors through VirusTotal.',
    'New scam sites often have no verdicts yet.',
  ],
  [
    'Domain registration',
    'When the domain was registered, by which registrar, and when it expires.',
    'A new domain is not proof of a scam; many ccTLDs publish limited data.',
  ],
  [
    'Link structure',
    'Impersonated brand names, look-alike spellings, mixed alphabets, IP-address links and other tricks.',
    'Based on the address only, not the page content.',
  ],
  [
    'Page content',
    'Where enabled: password or PIN fields, payment requests and fake branding — fetched safely, without running scripts.',
    'Some sites block automated visits or change later.',
  ],
  [
    'Job advert text',
    'Fees, unrealistic pay, urgency, secrecy, and requests for PINs or ID documents in a message you paste.',
    'Text without red flags can still be a scam.',
  ],
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-rule bg-surface">
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-14 sm:px-6 sm:pt-16">
          <div className="flex items-start justify-between gap-8">
            <div className="max-w-3xl">
              <h1 className="text-[2.35rem] leading-[1.05] font-extrabold tracking-[-0.03em] text-ink sm:text-6xl">
                Before you apply, make sure it&apos;s real.
              </h1>
              <p className="mt-5 max-w-[60ch] text-lg text-ink-soft sm:text-xl">
                Learn to recognize job scams and investigate suspicious recruitment links.
              </p>
            </div>
            <RadarMark animated className="hidden size-28 rounded-3xl md:block" />
          </div>
          <div className="mt-10">
            <HeroAnalyzer />
          </div>
        </div>
      </section>

      <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="how" className="text-3xl font-extrabold text-ink">
          How RadarJob works
        </h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span aria-hidden className="tabular block text-4xl font-extrabold text-signal">
                {i + 1}
              </span>
              <h3 className="mt-2 text-lg font-bold text-ink">{s.title}</h3>
              <p className="mt-1 text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="patterns" className="border-y border-rule bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="patterns" className="text-3xl font-extrabold text-ink">
            Common job scam patterns
          </h2>
          <p className="mt-2 max-w-[60ch] text-ink-soft">
            Most job scams follow a handful of patterns. Recognising them is the strongest
            protection there is.
          </p>
          <ul className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {PATTERNS.map((p) => (
              <li key={p.slug} className="border-l-4 border-caution pl-4">
                <h3 className="font-bold text-ink">{p.title}</h3>
                <p className="mt-1 text-ink-soft">{p.body}</p>
                <Link
                  href={`/learn/${p.slug}`}
                  className="mt-1 inline-block text-sm font-semibold text-signal underline-offset-4 hover:underline"
                >
                  Read the guide
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="checks" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="checks" className="text-3xl font-extrabold text-ink">
          What RadarJob checks
        </h2>
        <p className="mt-2 max-w-[60ch] text-ink-soft">
          Every report shows which checks ran, which failed and which were unavailable. A check that
          fails is never counted as a clean result.
        </p>
        <div className="mt-8 overflow-x-auto rounded-[var(--radius-panel)] border border-rule bg-surface">
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-rule bg-paper text-sm text-ink-soft">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Check
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  What it looks at
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  What it cannot tell you
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {CHECKS.map(([name, what, limit]) => (
                <tr key={name} className="align-top">
                  <th scope="row" className="px-4 py-4 font-semibold text-ink">
                    {name}
                  </th>
                  <td className="px-4 py-4 text-ink">{what}</td>
                  <td className="px-4 py-4 text-ink-soft">{limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="guides" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="guides" className="text-3xl font-extrabold text-ink">
            Learn the warning signs
          </h2>
          <Link
            href="/learn"
            className="inline-flex items-center gap-1 font-semibold text-signal underline-offset-4 hover:underline"
          >
            All {GUIDES.length} guides and the quiz <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.slice(0, 3).map((g) => (
            <li key={g.slug}>
              <EducationCard guide={g} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="limits" className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
        <div className="rounded-[var(--radius-panel)] border-2 border-ink bg-surface p-6 sm:p-8">
          <h2 id="limits" className="text-2xl font-extrabold text-ink">
            What automated checks cannot do
          </h2>
          <ul className="mt-4 grid gap-3 text-ink md:grid-cols-2">
            <li>No result proves that a job is real. A clean link can carry a fake offer.</li>
            <li>Brand-new scam sites are often unknown to every security vendor.</li>
            <li>RadarJob does not verify employers or confirm that a vacancy exists.</li>
            <li>When a check fails, the report says so — it is never treated as a pass.</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-ink p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Got a link that seems too good to be true?</h2>
            <p className="mt-1 text-white/80">
              Check it before you share a document, a code or a shilling.
            </p>
          </div>
          <Link
            href="/analyze"
            className={cn(buttonVariants({ size: 'lg' }), 'bg-white text-ink hover:bg-signal-wash')}
          >
            <ScanSearch /> Check a job link
          </Link>
        </div>
      </section>
    </>
  );
}
