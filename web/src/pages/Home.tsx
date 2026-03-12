import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, Check, Search, Download, BookOpen } from 'lucide-react';
import {
  siUbuntu, siFedora, siDebian, siArchlinux, siLinuxmint, siOpensuse,
  siManjaro, siPopos, siZorin, siElementary, siSolus, siVoidlinux,
  siGentoo, siNixos, siCentos, siRockylinux, siAlmalinux,
} from 'simple-icons';
import { listApps } from '../api/client';
import AppCard from '../components/AppCard';
import { useThemeStore } from '../stores/theme';

function isColorDark(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function adjustColor(hex: string, amount: number): string {
  const c = hex.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(c.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(c.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(c.substring(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const SLIDES = [
  {
    title: 'FriendlyHub is user-friendly',
    body: 'Clear explanations of what permissions do, apps can request the permissions they actually need, and one-click installs.',
    gradient: 'from-emerald-600 to-teal-700',
    image: '/images/banner_users.webp',
  },
  {
    title: 'FriendlyHub is developer-friendly',
    body: 'Clear review criteria, fully automated builds, and no gatekeeping on non-safety concerns. Your app, your choices.',
    gradient: 'from-blue-600 to-indigo-700',
    image: '/images/banner_developers.webp',
  },
  {
    title: 'FriendlyHub is community-friendly',
    body: "Fully open-sourced front-end, back-end, and build service. Don't like FriendlyHub? Clone it and deploy your own.",
    gradient: 'from-purple-600 to-fuchsia-700',
    image: '/images/banner_community.webp',
  },
  {
    title: 'FriendlyHub is AI-friendly',
    body: 'AI-assisted submissions are treated just like any other submission. We care about quality, not how you got there.',
    gradient: 'from-amber-600 to-orange-700',
    image: '/images/banner_ai.webp',
  },
];

const INTERVAL = 7000;

export default function Home() {
  const themeResolved = useThemeStore((s) => s.resolved);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    setProgress(0);
    startRef.current = Date.now();
  }, []);

  const next = useCallback(() => goTo((current + 1) % SLIDES.length), [current, goTo]);
  const prev = useCallback(() => goTo((current - 1 + SLIDES.length) % SLIDES.length), [current, goTo]);

  const touchStartX = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50) next();
    else if (delta > 50) prev();
  }, [next, prev]);

  useEffect(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(elapsed / INTERVAL, 1);
      setProgress(pct);
      if (pct >= 1) {
        setCurrent((c) => (c + 1) % SLIDES.length);
        setProgress(0);
        startRef.current = Date.now();
      }
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current]);

  const { data: allApps } = useQuery({
    queryKey: ['apps', 'home'],
    queryFn: () => listApps(undefined, 50),
  });

  const [appFilter, setAppFilter] = useState<'popular' | 'new' | 'updated'>('popular');

  const sortedApps = useMemo(() => {
    if (!allApps || allApps.length === 0) return [];
    const sorted = [...allApps];
    switch (appFilter) {
      case 'popular':
        sorted.sort((a, b) => b.install_count - a.install_count);
        break;
      case 'new':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'updated':
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
    }
    return sorted;
  }, [allApps, appFilter]);

  const featuredApps = useMemo(() => {
    if (!allApps || allApps.length === 0) return [];
    const shuffled = [...allApps].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(5, shuffled.length));
  }, [allApps]);

  const [appSlide, setAppSlide] = useState(0);
  const [appSlideDir, setAppSlideDir] = useState<'left' | 'right'>('left');
  const [copied, setCopied] = useState(false);
  const [setupTab, setSetupTab] = useState<'quick' | 'guided'>('quick');
  const [distroSearch, setDistroSearch] = useState('');
  const copyCommand = () => {
    navigator.clipboard.writeText('flatpak remote-add --if-not-exists friendlyhub https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const popularDistros = [
    { name: 'Ubuntu', slug: 'ubuntu', path: siUbuntu.path, hex: siUbuntu.hex },
    { name: 'Fedora', slug: 'fedora', path: siFedora.path, hex: siFedora.hex },
    { name: 'Debian', slug: 'debian', path: siDebian.path, hex: siDebian.hex },
    { name: 'Arch Linux', slug: 'arch-linux', path: siArchlinux.path, hex: siArchlinux.hex },
    { name: 'Linux Mint', slug: 'linux-mint', path: siLinuxmint.path, hex: siLinuxmint.hex },
    { name: 'openSUSE', slug: 'opensuse', path: siOpensuse.path, hex: siOpensuse.hex },
  ];

  const allDistros = [
    ...popularDistros,
    { name: 'Manjaro', slug: 'manjaro', path: siManjaro.path, hex: siManjaro.hex },
    { name: 'Pop!_OS', slug: 'pop-os', path: siPopos.path, hex: siPopos.hex },
    { name: 'Zorin OS', slug: 'zorin-os', path: siZorin.path, hex: siZorin.hex },
    { name: 'elementary OS', slug: 'elementary-os', path: siElementary.path, hex: siElementary.hex },
    { name: 'Solus', slug: 'solus', path: siSolus.path, hex: siSolus.hex },
    { name: 'Void Linux', slug: 'void-linux', path: siVoidlinux.path, hex: siVoidlinux.hex },
    { name: 'Gentoo', slug: 'gentoo', path: siGentoo.path, hex: siGentoo.hex },
    { name: 'NixOS', slug: 'nixos', path: siNixos.path, hex: siNixos.hex },
    { name: 'CentOS Stream', slug: 'centos-stream', path: siCentos.path, hex: siCentos.hex },
    { name: 'Rocky Linux', slug: 'rocky-linux', path: siRockylinux.path, hex: siRockylinux.hex },
    { name: 'AlmaLinux', slug: 'alma-linux', path: siAlmalinux.path, hex: siAlmalinux.hex },
  ];

  const filteredDistros = distroSearch
    ? allDistros.filter((d) => d.name.toLowerCase().includes(distroSearch.toLowerCase()))
    : [];
  const appNext = useCallback(() => {
    if (featuredApps.length > 0) {
      setAppSlideDir('left');
      setAppSlide((c) => (c + 1) % featuredApps.length);
    }
  }, [featuredApps.length]);
  const appPrev = useCallback(() => {
    if (featuredApps.length > 0) {
      setAppSlideDir('right');
      setAppSlide((c) => (c - 1 + featuredApps.length) % featuredApps.length);
    }
  }, [featuredApps.length]);

  const appTouchStartX = useRef(0);
  const handleAppTouchStart = useCallback((e: React.TouchEvent) => {
    appTouchStartX.current = e.touches[0].clientX;
  }, []);
  const handleAppTouchEnd = useCallback((e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - appTouchStartX.current;
    if (delta < -50) appNext();
    else if (delta > 50) appPrev();
  }, [appNext, appPrev]);

  const slide = SLIDES[current];

  return (
    <div>
      {/* Hero Carousel */}
      <section
        className="relative text-white max-h-87.5 overflow-hidden rounded-2xl mx-2 sm:mx-4 md:mx-6 lg:mx-8 xl:mx-12 2xl:mx-auto 2xl:max-w-351.25 mt-2.5"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${i === current ? 'opacity-100' : 'opacity-0'}`}
          >
            <img
              src={s.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top-right"
            />
            <div className="absolute inset-0 bg-black/70" />
          </div>
        ))}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:px-16">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              {slide.title}
            </h1>
            <p className="mt-4 text-lg text-white/80 max-w-[50%]">
              {slide.body}
            </p>
          </div>
          <div className="mt-8 flex gap-4">
            <Link
              to="/apps"
              className="bg-white text-gray-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Browse Apps
            </Link>
            <a
              href="https://github.com/friendlyhub"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/40 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              Publish Your App
            </a>
          </div>
        </div>

        <button
          onClick={prev}
          className="absolute left-6 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer hidden md:flex"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={next}
          className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer hidden md:flex"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Dots with countdown ring */}
        <div className="relative flex justify-center gap-3 -mt-12 pb-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="relative w-6 h-6 flex items-center justify-center cursor-pointer"
            >
              <svg className="absolute inset-0 w-6 h-6 -rotate-90" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeOpacity={0.3} strokeWidth={2} />
                {i === current && (
                  <circle
                    cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth={2}
                    strokeDasharray={62.83}
                    strokeDashoffset={62.83 * (1 - progress)}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <span className={`w-2 h-2 rounded-full ${i === current ? 'bg-white' : 'bg-white/40'}`} />
            </button>
          ))}
        </div>
      </section>

      {/* App Carousel */}
      {featuredApps.length > 0 && (() => {
        const app = featuredApps[appSlide];
        const bgColor = (themeResolved === 'dark' ? app.branding?.dark_color : app.branding?.light_color) ?? '#f3f4f6';
        const defaultScreenshot = app.screenshots.find((s) => s.is_default) ?? app.screenshots[0];
        const isDark = isColorDark(bgColor);
        return (
          <section
            className="relative overflow-hidden transition-colors duration-500 rounded-2xl mx-2 sm:mx-4 md:mx-6 lg:mx-8 xl:mx-12 2xl:mx-auto 2xl:max-w-351.25 shadow-lg h-72 xl:h-88 mt-8"
            style={{ background: `linear-gradient(135deg, ${bgColor}, ${adjustColor(bgColor, -20)})` }}
            onTouchStart={handleAppTouchStart}
            onTouchEnd={handleAppTouchEnd}
          >
            <div
              key={appSlide}
              className={`h-full max-w-7xl mx-auto px-4 sm:px-6 md:px-16 py-6 xl:py-8 flex flex-col ${appSlideDir === 'left' ? 'animate-slide-left' : 'animate-slide-right'}`}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Apps</h2>
                <Link
                  to="/apps"
                  className={`text-sm font-medium ${isDark ? 'text-white/80 hover:text-white' : 'text-emerald-600 hover:text-emerald-700'}`}
                >
                  View all &rarr;
                </Link>
              </div>
              <Link to={`/apps/${app.app_id}`} className="flex-1 min-h-0 flex flex-col md:flex-row items-center gap-4 md:gap-6 group">
                <div className="flex-1 min-w-0 flex flex-col items-center md:items-start">
                  {app.icon_url ? (
                    <img src={app.icon_url} alt="" className="w-16 h-16 lg:w-32 lg:h-32 rounded-xl shrink-0" />
                  ) : (
                    <div className={`w-16 h-16 lg:w-32 lg:h-32 rounded-xl flex items-center justify-center font-bold text-xl shrink-0 ${isDark ? 'bg-white/20 text-white' : 'bg-gray-900/10 text-gray-900'}`}>
                      {app.name.charAt(0)}
                    </div>
                  )}
                  <h3 className={`mt-2 text-2xl font-bold truncate max-w-full ${isDark ? 'text-white' : 'text-gray-900'}`}>{app.name}</h3>
                  <p className={`text-lg line-clamp-2 text-center md:text-left ${isDark ? 'text-white/80' : 'text-gray-600'}`}>{app.summary}</p>
                  {app.developer_name && (
                    <p className={`hidden md:block text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{app.developer_name}</p>
                  )}
                </div>
                {defaultScreenshot && (
                  <div className="shrink-0 hidden md:block md:w-80 lg:w-100 xl:w-120 self-start overflow-hidden rounded-t-xl">
                    <img
                      src={defaultScreenshot.url}
                      alt={defaultScreenshot.caption ?? `${app.name} screenshot`}
                      className="w-full object-cover object-top"
                    />
                  </div>
                )}
              </Link>
            </div>

            {featuredApps.length > 1 && (
              <>
                <button
                  onClick={appPrev}
                  className={`absolute left-6 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors cursor-pointer hidden md:flex ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-900/10 hover:bg-gray-900/20 text-gray-900'}`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={appNext}
                  className={`absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors cursor-pointer hidden md:flex ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-900/10 hover:bg-gray-900/20 text-gray-900'}`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-3 pb-4">
                  {featuredApps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setAppSlideDir(i > appSlide ? 'left' : 'right');
                        setAppSlide(i);
                      }}
                      className={`w-2 h-2 rounded-full cursor-pointer transition-colors ${i === appSlide ? (isDark ? 'bg-white' : 'bg-gray-900') : (isDark ? 'bg-white/30' : 'bg-gray-900/30')}`}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        );
      })()}

      {/* Manifesto + Setup */}
      <section className="mx-2 sm:mx-4 md:mx-6 lg:mx-8 xl:mx-12 2xl:mx-auto 2xl:max-w-351.25 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="grid grid-cols-2 gap-6">
            <Link
              to="/manifesto"
              className="bg-linear-to-br from-amber-400 to-yellow-500 rounded-2xl p-6 flex flex-col items-center justify-center text-amber-900 shadow-lg hover:from-amber-500 hover:to-yellow-600 transition-all cursor-pointer group"
            >
              <img src="/images/friendly_manifesto.svg" alt="Friendly Manifesto" className="w-28 h-28 mb-3" />
              <span className="font-semibold text-base text-center leading-tight">We follow the Friendly Manifesto</span>
              <span className="text-sm text-amber-800/70 mt-2 group-hover:underline">Find out how &rarr;</span>
            </Link>
            <a
              href="/docs/"
              className="bg-linear-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 flex flex-col items-center justify-center text-white shadow-lg hover:from-emerald-600 hover:to-teal-700 transition-all group"
            >
              <BookOpen className="w-28 h-28 mb-3 stroke-1" />
              <span className="font-semibold text-base text-center leading-tight">Documentation</span>
              <span className="text-sm text-white/70 mt-2 text-center group-hover:underline">Guides for users and developers &rarr;</span>
            </a>
          </div>
          <div className="bg-gray-900 rounded-2xl p-8 text-white shadow-lg">
            <h2 className="text-lg font-semibold mb-3">Add FriendlyHub to your system</h2>
            <div className="flex gap-2 mb-4">
              {(['quick', 'guided'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSetupTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    setupTab === tab
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="relative">
              {/* Guided tab always rendered to set container height */}
              <div className={setupTab === 'guided' ? '' : 'invisible'}>
                <p className="text-sm text-gray-400 mb-4">Choose your distribution</p>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mb-4">
                  {popularDistros.map((distro) => (
                    <Link
                      key={distro.slug}
                      to={`/setup/${distro.slug}`}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-gray-800 transition-colors group"
                      title={distro.name}
                    >
                      <svg role="img" viewBox="0 0 24 24" className="w-8 h-8" fill={`#${distro.hex}`}>
                        <path d={distro.path} />
                      </svg>
                      <span className="text-xs text-gray-400 group-hover:text-white truncate w-full text-center">{distro.name}</span>
                    </Link>
                  ))}
                  <Link
                    to="/setup"
                    className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-gray-800 transition-colors group"
                    title="Other distributions"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 group-hover:text-white text-xs font-medium">
                      ...
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-white">Other</span>
                  </Link>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={distroSearch}
                    onChange={(e) => setDistroSearch(e.target.value)}
                    placeholder="Search distributions..."
                    className="w-full bg-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {filteredDistros.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden z-10">
                      {filteredDistros.map((distro) => (
                        <Link
                          key={distro.slug}
                          to={`/setup/${distro.slug}`}
                          className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-700 transition-colors"
                          onClick={() => setDistroSearch('')}
                        >
                          <svg role="img" viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill={`#${distro.hex}`}>
                            <path d={distro.path} />
                          </svg>
                          {distro.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Quick tab overlaid on top */}
              {setupTab === 'quick' && (
                <div className="absolute inset-0">
                  <div className="relative w-full">
                    <code className="block bg-gray-800 rounded-lg p-4 pr-12 text-sm font-mono text-emerald-400">
                      flatpak remote-add --if-not-exists friendlyhub
                      https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
                    </code>
                    <button
                      onClick={copyCommand}
                      className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Copy and paste this to your terminal to add the FriendlyHub repository. Alternatively, download the repo file below.
                  </p>
                  <a
                    href="https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo"
                    download
                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    friendlyhub.flatpakrepo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* App listing */}
      {allApps && allApps.length > 0 && (
        <section className="mx-2 sm:mx-4 md:mx-6 lg:mx-8 xl:mx-12 2xl:mx-auto 2xl:max-w-351.25 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              {(['popular', 'new', 'updated'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setAppFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    appFilter === filter
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {filter === 'popular' ? 'Popular' : filter === 'new' ? 'New' : 'Updated'}
                </button>
              ))}
            </div>
            {sortedApps.length > 12 && (
              <Link to="/apps" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                View all &rarr;
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedApps.slice(0, 12).map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
