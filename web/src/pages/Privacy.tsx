export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: 17th March 2026</p>

      <div className="space-y-8 text-gray-700 dark:text-gray-300">
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">What FriendlyHub Is</h2>
          <p>
            FriendlyHub is a Flatpak app repository. We host and distribute Linux desktop applications
            submitted by developers. This policy covers the FriendlyHub website (friendlyhub.org) and
            the Flatpak repository (dl.friendlyhub.org).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Data We Collect</h2>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-4 mb-2">Developer accounts (GitHub OAuth)</h3>
          <p className="mb-2">
            When you sign in with GitHub to submit apps, we store the following from your GitHub profile:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>GitHub user ID and username</li>
            <li>Display name</li>
            <li>Email address (if public on your GitHub profile)</li>
            <li>Avatar URL</li>
          </ul>
          <p className="mt-2">
            We also store a GitHub OAuth access token to interact with GitHub on your behalf
            (creating app repositories, triggering builds). This token is stored server-side
            and is never exposed to the browser.
          </p>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-4 mb-2">App install statistics</h3>
          <p>
            We count how many times each app is installed by parsing CDN access logs. These logs
            contain IP addresses and user agents, but we only extract aggregate download counts
            per app. We do not store individual IP addresses or build user profiles from this data.
            CDN logs are automatically deleted after 30 days.
          </p>

          <h3 className="font-semibold text-gray-900 dark:text-white mt-4 mb-2">Browsing the website</h3>
          <p>
            If you browse FriendlyHub without signing in, we do not collect any personal data.
            We do not use cookies for tracking, analytics services, or advertising. The only
            cookie-like storage used is a JWT session token in your browser's local storage if
            you sign in.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">How We Use Your Data</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Developer account data is used to authenticate you and manage your app submissions.</li>
            <li>Your GitHub username and avatar are displayed publicly on your app listings.</li>
            <li>Install counts are displayed publicly on app pages.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Where Your Data Is Stored</h2>
          <p>
            All data is stored on AWS infrastructure in the EU (eu-west-1, Ireland). We use
            DynamoDB for application data and CloudFront for content delivery.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Third Parties</h2>
          <p>
            We do not sell, share, or provide your data to any third parties. The only external
            service we interact with on your behalf is GitHub (for OAuth authentication, repository
            management, and build pipelines).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Distributed Apps</h2>
          <p>
            Apps distributed through FriendlyHub are built directly from developer-provided
            manifests. We do not inject telemetry, tracking, analytics, or any other code
            into the apps we distribute.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Account Deletion</h2>
          <p>
            To delete your account and associated data, open an issue on the{' '}
            <a
              href="https://github.com/friendlyhub/friendlyhub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              FriendlyHub GitHub repository
            </a>
            {' '}or contact us directly. We will remove your account data from our systems.
            Published apps can be unpublished and deleted from the dashboard area of the FriendlyHub website.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Changes to This Policy</h2>
          <p>
            If we make changes to this policy, we will update the date at the top of this page.
            For significant changes, we will notify registered developers via GitHub.
          </p>
        </section>
      </div>
    </div>
  );
}
