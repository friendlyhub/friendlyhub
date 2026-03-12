import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'FriendlyHub Docs',
  description: 'Documentation for FriendlyHub, a friendly Flatpak repository',
  base: '/docs/',

  head: [
    ['link', { rel: 'icon', href: '/docs/friendlyhub_logo.svg', type: 'image/svg+xml' }],
  ],

  themeConfig: {
    logo: '/friendlyhub_logo.svg',
    siteTitle: 'FriendlyHub',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Submit an App', link: '/submitting-an-app' },
      { text: 'Reviewing', link: '/reviewing' },
      { text: 'Back to FriendlyHub', link: 'https://friendlyhub.org' },
    ],

    sidebar: [
      {
        text: 'User Guide',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
        ],
      },
      {
        text: 'Developer Guide',
        items: [
          { text: 'Submitting an App', link: '/submitting-an-app' },
        ],
      },
      {
        text: 'Reviewer Guide',
        items: [
          { text: 'Reviewing Submissions', link: '/reviewing' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/friendlyhub' },
    ],

    footer: {
      message: 'FriendlyHub follows the <a href="/manifesto">Friendly Manifesto</a>',
    },

    search: {
      provider: 'local',
    },
  },
})
