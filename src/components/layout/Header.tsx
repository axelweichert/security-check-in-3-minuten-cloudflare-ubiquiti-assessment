import { useTranslation } from 'react-i18next';
import { Globe, Sun, Moon } from 'lucide-react';
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
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center space-x-4 md:space-x-6">
          <img src="https://imagedelivery.net/3_b412f08-sU2i2-0h-oQ/a85c8675-34ed-4375-251f-387ed53b5c00/public" alt="von Busch GmbH" className="h-7 md:h-8 transition-transform hover:scale-105" />
          <span className="text-primary/30 text-2xl font-light">|</span>
          <img src="https://imagedelivery.net/3_b412f08-sU2i2-0h-oQ/55d3542a-59a1-4c02-125a-243a24a82600/public" alt="Cloudflare" className="h-7 md:h-8 transition-transform hover:scale-105" />
          <span className="text-primary/30 text-2xl font-light hidden sm:inline-block">|</span>
          <img src="https://imagedelivery.net/3_b412f08-sU2i2-0h-oQ/a82b4a0a-814c-4a33-e116-0c21a1158400/public" alt="Ubiquiti" className="h-6 md:h-7 hidden sm:inline-block transition-transform hover:scale-105" />
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