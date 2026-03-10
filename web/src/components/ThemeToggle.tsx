import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../stores/theme';

export default function ThemeToggle() {
  const { preference, resolved, setPreference } = useThemeStore();

  const handleClick = () => {
    if (preference === 'light') setPreference('dark');
    else if (preference === 'dark') setPreference('system');
    else setPreference(resolved === 'dark' ? 'light' : 'dark');
  };

  let Icon: typeof Sun;
  let title: string;

  if (preference === 'light') {
    Icon = Sun;
    title = 'Light mode (click for dark)';
  } else if (preference === 'dark') {
    Icon = Moon;
    title = 'Dark mode (click for system)';
  } else {
    Icon = resolved === 'dark' ? Sun : Moon;
    title = `System mode (click for ${resolved === 'dark' ? 'light' : 'dark'})`;
  }

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors cursor-pointer"
      title={title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
