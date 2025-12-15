import { useTranslation } from 'react-i18next';
import { Globe, Sun, Moon, Shield, Wifi, Layers, Crosshair } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFunnelStore } from '@/store/funnel-store';
export function Header() {
  const { i18n } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const setLanguage = useFunnelStore(s => s.setLanguage);
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setLanguage(lng);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lng);
    window.history.pushState({}, '', url);
  };
  return (
    <header className="py-4 sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center space-x-2 md:space-x-4 text-sm md:text-base">
          <a href="https://www.vonbusch.digital" target="_blank" rel="noopener noreferrer" className="group transition-colors duration-200 hover:text-primary/90 flex items-center gap-1.5">
            <Layers className="h-5 w-5 flex-shrink-0 opacity-80 text-black dark:text-white" />
            <span className="font-semibold">von Busch GmbH</span>
          </a>
          <span className="text-muted-foreground/50 text-xl font-light hidden sm:inline-block">|</span>
          <a href="https://www.hxnwrk.de" target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 group transition-colors duration-200 hover:text-primary/90">
            <Crosshair className="h-4 w-4 opacity-80 text-[#3772EB]" />
            <span className="font-semibold text-xs md:text-sm">HXNWRK</span>
          </a>
          <span className="text-muted-foreground/50 text-xl font-light">|</span>
          <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer" className="group transition-colors duration-200 hover:text-foreground flex items-center gap-1.5">
            <Shield className="h-5 w-5 mr-1 text-[#F38020]" />
            <span className="font-medium">Cloudflare</span>
          </a>
          <span className="text-muted-foreground/50 text-xl font-light hidden sm:inline-block">|</span>
          <a href="https://www.ui.com" target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 group transition-colors duration-200 hover:text-foreground">
            <Wifi className="h-4 w-4 text-green-500 mr-1" />
            <span className="font-medium">Ubiquiti</span>
          </a>
        </div>
        <div className="flex items-center space-x-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="transition-transform hover:scale-110 hover:text-primary">
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => changeLanguage('de')}>Deutsch</DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLanguage('en')}>English</DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLanguage('fr')}>Français</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="transition-transform hover:scale-110 hover:text-primary">
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </header>
  );
}