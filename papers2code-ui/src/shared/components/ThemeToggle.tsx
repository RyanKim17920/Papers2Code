import React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/shared/ui/button';

interface ThemeToggleProps {
  variant?: 'default' | 'outline' | 'ghost';
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  variant = 'outline', 
  showLabel = false 
}) => {
  const { theme, setTheme } = useTheme();

  const getNextTheme = () => {
    if (theme === 'light') return 'dark';
    if (theme === 'dark') return 'system';
    return 'light';
  };

  const getThemeIcon = () => {
    if (theme === 'dark') return <Moon size={18} />;
    if (theme === 'light') return <Sun size={18} />;
    return <Monitor size={18} />;
  };

  const getThemeLabel = () => {
    if (theme === 'dark') return 'Dark';
    if (theme === 'light') return 'Light';
    return 'System';
  };

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => setTheme(getNextTheme())}
      className="gap-2"
      title={`Current theme: ${getThemeLabel()}`}
    >
      {getThemeIcon()}
      {showLabel && <span>{getThemeLabel()}</span>}
    </Button>
  );
};
