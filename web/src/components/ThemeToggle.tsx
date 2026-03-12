import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '../stores/theme';

const positions = ['light', 'system', 'dark'] as const;
type Pref = (typeof positions)[number];

const icons = {
  light: Sun,
  system: Monitor,
  dark: Moon,
};

const titles: Record<Pref, string> = {
  light: 'Light theme',
  system: 'System theme',
  dark: 'Dark theme',
};

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const { preference, setPreference } = useThemeStore();

  // Cycle: system -> opposite of system -> same as system -> system
  const handleClick = () => {
    const sys = getSystemTheme();
    if (preference === 'system') {
      setPreference(sys === 'light' ? 'dark' : 'light');
    } else if (preference !== sys) {
      // Currently at opposite of system, go to same as system
      setPreference(sys);
    } else {
      // Currently at same as system, go back to system
      setPreference('system');
    }
  };

  const idx = positions.indexOf(preference);
  // pill offset: 0%, 100%, 200% of one button width
  const pillOffset = idx * 100;

  return (
    <div
      className="relative flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 cursor-pointer"
      onClick={handleClick}
      title={titles[preference]}
    >
      {/* Sliding pill */}
      <div
        className="absolute top-0.5 bottom-0.5 w-1/3 bg-white dark:bg-gray-600 rounded-md shadow-sm transition-transform duration-200 ease-in-out"
        style={{ transform: `translateX(${pillOffset}%)` }}
      />
      {/* Icons */}
      {positions.map((pos) => {
        const Icon = icons[pos];
        const isActive = preference === pos;
        return (
          <div
            key={pos}
            className={`relative z-10 p-1.5 transition-colors ${
              isActive
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        );
      })}
    </div>
  );
}
