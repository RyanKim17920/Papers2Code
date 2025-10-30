import React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor, Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';

export const ThemeSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const themes = [
    {
      value: 'light',
      label: 'Light',
      description: 'Clean and bright interface',
      icon: Sun,
      preview: 'bg-gradient-to-br from-white to-gray-50',
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Easy on the eyes in low light',
      icon: Moon,
      preview: 'bg-gradient-to-br from-gray-900 to-gray-800',
    },
    {
      value: 'system',
      label: 'System',
      description: 'Automatically match your system preference',
      icon: Monitor,
      preview: 'bg-gradient-to-br from-gray-400 to-gray-500',
    },
  ];

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Palette size={20} className="text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Appearance</CardTitle>
            <CardDescription className="text-sm mt-0.5">
              Customize the interface to match your preference
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Choose your preferred color theme. System option will automatically switch between light and dark based on your device settings.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {themes.map((themeOption) => {
              const Icon = themeOption.icon;
              const isSelected = theme === themeOption.value;
              
              return (
                <Button
                  key={themeOption.value}
                  variant={isSelected ? 'default' : 'outline'}
                  size="lg"
                  className={`h-auto flex flex-col items-center gap-3 p-6 relative transition-all ${
                    isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                  onClick={() => setTheme(themeOption.value)}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                  <div className={`w-full h-20 rounded-lg ${themeOption.preview} mb-2`} />
                  <Icon className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">{themeOption.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {themeOption.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
