export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  /** Scenarios are fictional. */
  scenario?: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
  /** Explanation of why the most tempting wrong answer is wrong. */
  whyOthersAreWrong: string;
  guideSlug: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q-fee',
    scenario:
      'Fictional: You receive an SMS saying you are shortlisted for a supermarket job you never applied for. You must pay KES 750 to "book your interview".',
    prompt: 'What is the safest response?',
    options: [
      { id: 'a', text: 'Pay quickly — KES 750 is a small amount for a job.' },
      {
        id: 'b',
        text: 'Do not pay. Contact the supermarket through its official website or office.',
      },
      { id: 'c', text: 'Reply asking for a discount on the fee.' },
      { id: 'd', text: 'Forward the SMS to friends so they can apply too.' },
    ],
    correctOptionId: 'b',
    explanation:
      'Interview "booking fees" are a classic scam pattern, and being shortlisted for a job you never applied for is a red flag. Verify through channels you find yourself.',
    whyOthersAreWrong:
      'Small fees are deliberately chosen to feel low-risk; they are often followed by more fees.',
    guideSlug: 'recruitment-fee-scams',
  },
  {
    id: 'q-domain',
    scenario:
      "Fictional: A job link points to bigbank.careers-verify.example. The real bank's website is bigbank.example.",
    prompt: 'Who actually controls the website in the link?',
    options: [
      { id: 'a', text: 'Big Bank — its name is at the start of the address.' },
      { id: 'b', text: 'Whoever owns careers-verify.example.' },
      { id: 'c', text: 'It is impossible to tell from the address.' },
    ],
    correctOptionId: 'b',
    explanation:
      'The registered domain — the part immediately before the ending (here careers-verify.example) — determines who controls a site. Anything to the left is a subdomain the owner can name freely.',
    whyOthersAreWrong:
      'Putting a brand name at the start of an address is a common impersonation trick.',
    guideSlug: 'phishing-links-fake-career-sites',
  },
  {
    id: 'q-otp',
    prompt:
      'A recruiter asks you to send them the 6-digit code you just received by SMS "to verify your number". What should you do?',
    options: [
      { id: 'a', text: 'Send it — it only verifies your phone number.' },
      { id: 'b', text: 'Never share it. One-time codes are used to take over accounts.' },
      { id: 'c', text: 'Send only the first three digits.' },
    ],
    correctOptionId: 'b',
    explanation:
      'One-time codes authorise logins, password resets and payments. No legitimate recruiter needs them.',
    whyOthersAreWrong:
      'Even part of a code can help an attacker, and the request itself shows bad intent.',
    guideSlug: 'identity-theft-sensitive-information',
  },
  {
    id: 'q-vt-clean',
    prompt:
      'A link scanner reports "0 security vendors flagged this URL". What does that tell you?',
    options: [
      { id: 'a', text: 'The job is definitely genuine.' },
      { id: 'b', text: 'The website is definitely safe.' },
      {
        id: 'c',
        text: 'No vendor has flagged it yet — new or targeted scam sites can still be dangerous.',
      },
    ],
    correctOptionId: 'c',
    explanation:
      'Reputation services can only flag sites that someone has already detected. Brand-new phishing sites often have zero detections for a while.',
    whyOthersAreWrong: 'A clean scan says nothing about whether the job offer itself is real.',
    guideSlug: 'phishing-links-fake-career-sites',
  },
  {
    id: 'q-tasks',
    scenario:
      'Fictional: On Telegram you earn KES 900 for rating hotels. You are now asked to deposit KES 5,000 for a "VIP task pack".',
    prompt: 'What is most likely happening?',
    options: [
      { id: 'a', text: 'A task scam — early payouts build trust before deposits are taken.' },
      { id: 'b', text: 'A normal promotion for loyal workers.' },
      { id: 'c', text: 'A training requirement used by most online employers.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Small early payments are used to make the scheme feel real. Genuine employers do not require deposits for you to work.',
    whyOthersAreWrong: 'Paying to unlock work is the core of the scam, not a normal promotion.',
    guideSlug: 'whatsapp-telegram-recruitment-scams',
  },
  {
    id: 'q-mule',
    prompt:
      'A remote "transaction coordinator" job asks you to receive client payments on your M-PESA and forward them, keeping 10%. What is the main risk?',
    options: [
      { id: 'a', text: 'Low pay.' },
      { id: 'b', text: 'You may be moving stolen money and could be held responsible.' },
      { id: 'c', text: 'Transaction fees.' },
    ],
    correctOptionId: 'b',
    explanation:
      'This is money-mule recruitment. The account holder is the person investigators can trace.',
    whyOthersAreWrong: 'The financial and legal risk far outweighs fees or commission levels.',
    guideSlug: 'money-mule-recruitment',
  },
  {
    id: 'q-email',
    prompt:
      'An offer from an international NGO arrives from an @gmail address. What is the best next step?',
    options: [
      { id: 'a', text: 'Accept — NGOs often use Gmail.' },
      {
        id: 'b',
        text: "Check the NGO's official website for the vacancy and contact its HR through official details.",
      },
      { id: 'c', text: 'Reply asking whether the offer is real.' },
    ],
    correctOptionId: 'b',
    explanation:
      'A free email address is a warning sign for a large organisation. Verify with contact details you find independently.',
    whyOthersAreWrong:
      'Asking the possible scammer whether they are genuine will not give you a reliable answer.',
    guideSlug: 'employer-impersonation',
  },
  {
    id: 'q-urgency',
    prompt:
      '"Pay within 30 minutes or the slot goes to the next candidate. Do not tell anyone." Which tactics are being used?',
    options: [
      { id: 'a', text: 'Urgency and secrecy.' },
      { id: 'b', text: 'Standard HR policy.' },
      { id: 'c', text: 'Fair competition.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Deadlines stop you from checking; secrecy stops you from getting advice. Both are classic social-engineering tactics.',
    whyOthersAreWrong: 'Legitimate employers give you time to consider an offer.',
    guideSlug: 'social-engineering-urgency',
  },
  {
    id: 'q-interview',
    prompt:
      'You were "interviewed" by text for 20 minutes and offered a well-paid job. They now ask for your ID scan and a background-check fee. What do you do?',
    options: [
      { id: 'a', text: 'Send the ID but not the fee.' },
      {
        id: 'b',
        text: 'Send nothing until you have verified the company and interviewer through official channels.',
      },
      { id: 'c', text: 'Pay the fee — background checks are normal.' },
    ],
    correctOptionId: 'b',
    explanation:
      'Instant offers after chat-only interviews, plus requests for ID and fees, are strong warning signs.',
    whyOthersAreWrong: 'An ID scan alone can be misused for loans or SIM registration.',
    guideSlug: 'fake-interviews-fraudulent-offers',
  },
  {
    id: 'q-equipment',
    prompt:
      'A remote employer hires you and requires you to buy a "certified software licence" from a link they send before you get work. This is:',
    options: [
      { id: 'a', text: 'A warning sign of a fake remote job.' },
      { id: 'b', text: 'Normal onboarding for remote work.' },
      { id: 'c', text: 'Required by law.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Requiring purchases from a supplier the "employer" chooses is a common way fake remote jobs make money.',
    whyOthersAreWrong: 'Genuine employers usually provide or reimburse tools they require.',
    guideSlug: 'fake-remote-jobs',
  },
];
