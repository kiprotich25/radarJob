export interface Resource {
  name: string;
  url: string;
  description: string;
  region: 'Kenya' | 'International';
}

/**
 * Authoritative organisations users can consult. RadarJob has no partnership with any of them;
 * these are listed only as places where users can verify or report.
 */
export const RESOURCES = {
  nea: {
    name: 'National Employment Authority (NEA)',
    url: 'https://www.nea.go.ke',
    description:
      'Government body that registers private employment agencies in Kenya. Check whether a recruitment agency is registered before paying or travelling.',
    region: 'Kenya',
  },
  dci: {
    name: 'Directorate of Criminal Investigations (DCI)',
    url: 'https://www.dci.go.ke',
    description: 'Report fraud and cybercrime to the police in Kenya.',
    region: 'Kenya',
  },
  kecirt: {
    name: 'National KE-CIRT/CC (Communications Authority of Kenya)',
    url: 'https://www.ke-cirt.go.ke',
    description:
      "Kenya's national cyber incident response team. Report phishing sites and cyber incidents.",
    region: 'Kenya',
  },
  safaricom: {
    name: 'Safaricom fraud awareness',
    url: 'https://www.safaricom.co.ke/fraud-awareness',
    description:
      'Guidance on M-PESA and SIM-related scams. Safaricom customers can forward scam SMS messages to 333.',
    region: 'Kenya',
  },
  odpc: {
    name: 'Office of the Data Protection Commissioner (ODPC)',
    url: 'https://www.odpc.go.ke',
    description: 'Complain about misuse of your personal data in Kenya.',
    region: 'Kenya',
  },
  ftcJobScams: {
    name: 'US Federal Trade Commission — Job scams',
    url: 'https://consumer.ftc.gov/articles/job-scams',
    description: 'Plain-language guidance on recognising and reporting job scams.',
    region: 'International',
  },
  ftcReport: {
    name: 'ReportFraud.ftc.gov',
    url: 'https://reportfraud.ftc.gov',
    description: 'Report fraud to the US Federal Trade Commission.',
    region: 'International',
  },
  actionFraud: {
    name: 'Action Fraud (UK)',
    url: 'https://www.actionfraud.police.uk',
    description: "The UK's national reporting centre for fraud and cybercrime.",
    region: 'International',
  },
} satisfies Record<string, Resource>;

export type ResourceKey = keyof typeof RESOURCES;
