import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { listApps } from '../api/client';
import AppCard from '../components/AppCard';

const SLIDES = [
  {
    title: 'FriendlyHub is user-friendly',
    body: 'Clear explanations of what permissions do, apps that request only the permissions they actually need, and one-click installs from your browser.',
    gradient: 'from-emerald-600 to-teal-700',
  },
  {
    title: 'FriendlyHub is developer-friendly',
    body: 'Clear review criteria, fully automated builds, and no gatekeeping on non-safety concerns. Your app, your choices.',
    gradient: 'from-blue-600 to-indigo-700',
  },
  {
    title: 'FriendlyHub is community-friendly',
    body: "Fully open-sourced front-end, back-end, and build service. Don't like FriendlyHub? Clone it and deploy your own.",
    gradient: 'from-purple-600 to-fuchsia-700',
  },
  {
    title: 'FriendlyHub is AI-friendly',
    body: 'AI-assisted submissions are treated just like any other submission. We care about quality, not how you got there.',
    gradient: 'from-amber-600 to-orange-700',
  },
];

const INTERVAL = 7000;

export default function Home() {
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

  const { data: apps } = useQuery({
    queryKey: ['apps', 'home'],
    queryFn: () => listApps(undefined, 12),
  });

  const slide = SLIDES[current];

  return (
    <div>
      {/* Hero Carousel */}
      <section
        className={`relative bg-gradient-to-br ${slide.gradient} text-white transition-colors duration-700`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:px-16">
          <div className="max-w-2xl min-h-[180px]">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
              {slide.title}
            </h1>
            <p className="mt-4 text-lg text-white/80">
              {slide.body}
            </p>
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
        <div className="flex justify-center gap-3 pb-8">
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

      {/* Setup instructions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gray-900 rounded-2xl p-8 text-white">
          <h2 className="text-lg font-semibold mb-3">Add FriendlyHub to your system</h2>
          <code className="block bg-gray-800 rounded-lg p-4 text-sm font-mono text-emerald-400">
            flatpak remote-add --if-not-exists friendlyhub
            https://dl.friendlyhub.org/repo/friendlyhub.flatpakrepo
          </code>
        </div>
      </section>

      {/* Featured / Recent Apps */}
      {apps && apps.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Apps</h2>
            <Link
              to="/apps"
              className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </section>
      )}

      {/* Value props */}
      <section className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">No Gatekeeping</h3>
              <p className="mt-2 text-gray-600">
                We review for safety and accuracy, not icon quality or naming
                conventions. Your app, your choices.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Automated Builds</h3>
              <p className="mt-2 text-gray-600">
                Submit your Flatpak manifest, and GitHub Actions handles the rest.
                Fast, reliable, transparent build logs.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Fully Compatible</h3>
              <p className="mt-2 text-gray-600">
                Works with the standard Flatpak CLI, GNOME Software, and KDE
                Discover. Run alongside Flathub with zero conflicts.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
