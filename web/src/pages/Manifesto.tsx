import { CheckCircle2, ExternalLink } from 'lucide-react';

interface PrincipleProps {
  id: string;
  text: string;
  conforms: boolean;
  notes?: string[];
}

function Principle({ id, text, conforms, notes }: PrincipleProps) {
  return (
    <div className="py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex items-start gap-3">
        {conforms && <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />}
        <div>
          <p className="text-gray-900 dark:text-white">
            <span className="font-mono text-sm text-gray-500 dark:text-gray-400 mr-2">{id}</span>
            {text}
          </p>
          {notes && notes.length > 0 && (
            <ul className="mt-2 space-y-1">
              {notes.map((note, i) => (
                <li key={i} className="text-sm text-gray-600 dark:text-gray-400 pl-1">
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const SECTIONS = [
  {
    title: 'Transparency & Communication',
    id: '3.1',
    principles: [
      {
        id: '3.1.1',
        text: 'We make it clear to users whether our platform actively reviews submitted software, and to what extent.',
        conforms: true,
        notes: [
          'Our review process: automated checks (manifest lint, permissions audit, metadata completeness) followed by light human review focused on safety and accuracy.',
        ],
      },
      {
        id: '3.1.2',
        text: 'We are transparent about our acceptance/rejection criteria and publish them publicly.',
        conforms: true,
        notes: [
          'Automated checks verify manifest validity, flag dangerous permissions, and check for required metadata (.desktop file, AppStream metainfo).',
          'Human review covers only: malware/safety, accurate metadata, and that the app works.',
          'We do not gatekeep on icon quality, naming conventions, desktop environment compliance, or code quality.',
        ],
      },
      {
        id: '3.1.3',
        text: 'We provide clear, actionable feedback when requesting changes to a submission.',
        conforms: true,
        notes: [
          'All automated check results are shown to developers with specific details about what to fix.',
          'Human reviewers can only select "approved" or "changes requested" with written feedback.',
        ],
      },
      {
        id: '3.1.4',
        text: 'Any rejection includes a written explanation citing specific review criteria that the submission violates.',
        conforms: true,
        notes: [
          'We don\'t have a "rejected" status. Submissions are either "approved" or "changes requested" with actionable feedback.',
        ],
      },
      {
        id: '3.1.5',
        text: 'We conduct all interactions with developers in a professional and respectful manner.',
        conforms: true,
      },
    ],
  },
  {
    title: 'Security & Privacy',
    id: '3.2',
    principles: [
      {
        id: '3.2.1',
        text: 'We do not, to the best of our abilities, distribute software with known critical security vulnerabilities.',
        conforms: true,
        notes: [
          'Automated permissions audit flags dangerous sandbox permissions (full host filesystem, root access, system bus, all devices).',
          'Human reviewers check for malware and safety concerns.',
        ],
      },
      {
        id: '3.2.2',
        text: 'We do not, to the best of our abilities, distribute software that intentionally violates user privacy.',
        conforms: true,
        notes: [
          'Permissions audit highlights privacy-relevant sandbox escapes. Human review catches intentionally deceptive apps.',
        ],
      },
      {
        id: '3.2.3',
        text: 'We have a reasonable disclosure process for reporting security issues in software we distribute.',
        conforms: true,
        notes: [
          'Security issues can be reported via GitHub issues on the app\'s repository or via the FriendlyHub monorepo.',
        ],
      },
    ],
  },
  {
    title: 'Fairness & Objectivity',
    id: '3.3',
    principles: [
      {
        id: '3.3.1',
        text: 'We agree that the purpose of our platform is to distribute and promote software, not to create an ideological walled garden.',
        conforms: true,
      },
      {
        id: '3.3.2',
        text: 'We do not reject software based on subjective aesthetic preferences.',
        conforms: true,
        notes: [
          'No gatekeeping on icon quality, naming conventions, or design choices.',
        ],
      },
      {
        id: '3.3.3',
        text: 'We do not reject submissions that compete with our own products or services.',
        conforms: true,
        notes: ['We do not offer competing products.'],
      },
      {
        id: '3.3.4',
        text: 'We apply our review criteria consistently and equally to all submissions.',
        conforms: true,
        notes: ['All submissions go through the same automated checks and human review process.'],
      },
      {
        id: '3.3.5',
        text: 'We do not require developers to use specific toolkits, UI frameworks, libraries, or design languages as a condition for acceptance.',
        conforms: true,
        notes: ['None required.'],
      },
      {
        id: '3.3.6',
        text: 'We do not reject submissions based on perceived complexity, size, or scope.',
        conforms: true,
      },
      {
        id: '3.3.7',
        text: 'We do not reject submissions based on the tools or methods used to write the software (e.g. AI-assisted, low-code, generated code).',
        conforms: true,
        notes: ['AI-assisted submissions are treated the same as any other submission.'],
      },
    ],
  },
  {
    title: 'Developer Relations',
    id: '3.4',
    principles: [
      {
        id: '3.4.1',
        text: 'We have a publicly stated timeframe for responding to submissions and adhere to it.',
        conforms: true,
        notes: ['We aim to review submissions within 48 hours.'],
      },
      {
        id: '3.4.2',
        text: 'We provide a clear appeals process for rejected or removed software.',
        conforms: true,
        notes: ['Developers can open a GitHub issue on the FriendlyHub monorepo to appeal any decision.'],
      },
      {
        id: '3.4.3',
        text: 'We do not remove currently published software without notifying the developer and giving them an opportunity to address concerns.',
        conforms: true,
        notes: [
          'Developers are notified via GitHub and given the opportunity to address concerns before any removal.',
        ],
      },
      {
        id: '3.4.4',
        text: 'We do not reject new submissions based on criteria that, if applied retroactively, would require removing existing published software.',
        conforms: true,
      },
    ],
  },
  {
    title: 'User Respect',
    id: '3.5',
    principles: [
      {
        id: '3.5.1',
        text: 'We do not bundle additional software, telemetry, or modifications into distributed packages without the developer\'s consent.',
        conforms: true,
        notes: ['Apps are built directly from the developer\'s manifest. We add nothing.'],
      },
      {
        id: '3.5.2',
        text: 'We accurately represent the software\'s origin (original developer vs. community packaged).',
        conforms: true,
        notes: [
          'Verified developers (who own the app\'s domain) are shown with a green verified badge.',
          'Community-packaged apps are shown with a blue community badge.',
        ],
      },
    ],
  },
];

const SUMMARY = [
  { section: '3.1. Transparency & Communication', status: 'Full' },
  { section: '3.2. Security & Privacy', status: 'Full' },
  { section: '3.3. Fairness & Objectivity', status: 'Full' },
  { section: '3.4. Developer Relations', status: 'Full' },
  { section: '3.5. User Respect', status: 'Full' },
];

export default function Manifesto() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-4 mb-6">
        <img src="/images/friendly_manifesto.svg" alt="Friendly Manifesto" className="w-16 h-16" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Friendly Manifesto</h1>
          <p className="text-gray-600 dark:text-gray-400">Gatekeeper Conformity Declaration</p>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-8">
        <p className="text-amber-900 dark:text-amber-200">
          This document declares how <strong>FriendlyHub</strong> follows the{' '}
          <a
            href="https://friendlymanifesto.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline inline-flex items-center gap-1"
          >
            Friendly Manifesto
            <ExternalLink className="w-3.5 h-3.5" />
          </a>{' '}
          (v1.0) principles for Gatekeepers. This declaration is voluntary and self-assessed. By publishing
          it, we are publicly committing to these principles and inviting others to hold us to them.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 text-sm">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
          <span className="text-gray-500 dark:text-gray-400 block">Platform</span>
          <span className="font-medium text-gray-900 dark:text-white">FriendlyHub</span>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
          <span className="text-gray-500 dark:text-gray-400 block">Operator</span>
          <span className="font-medium text-gray-900 dark:text-white">FriendlyHub Contributors</span>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
          <span className="text-gray-500 dark:text-gray-400 block">Date</span>
          <span className="font-medium text-gray-900 dark:text-white">12th March 2026</span>
        </div>
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
          <span className="text-gray-500 dark:text-gray-400 block">Manifesto Version</span>
          <span className="font-medium text-gray-900 dark:text-white">1.0</span>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.id} className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            {section.id}. {section.title}
          </h2>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {section.principles.map((p) => (
              <Principle key={p.id} {...p} />
            ))}
          </div>
        </div>
      ))}

      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Summary</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Section</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Conformity</th>
              </tr>
            </thead>
            <tbody>
              {SUMMARY.map((row) => (
                <tr key={row.section} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{row.section}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-6">
        <p>
          Learn more at{' '}
          <a
            href="https://friendlymanifesto.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            friendlymanifesto.org
          </a>
        </p>
      </div>
    </div>
  );
}
