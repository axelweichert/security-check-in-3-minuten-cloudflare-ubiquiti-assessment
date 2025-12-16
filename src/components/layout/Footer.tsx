import { useTranslation } from 'react-i18next';
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="w-full border-t border-border/40 mt-auto">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-muted-foreground text-sm">
        <div className="space-y-2">
          <p>vonBusch – Alfred-Bozi-Straße 12 – 33602 Bielefeld</p>
          <div className="space-x-4">
            <a href="#" className="hover:text-primary transition-colors">Impressum</a>
            <span>|</span>
            <a href="#" className="hover:text-primary transition-colors">Datenschutz</a>
          </div>
          <p>Ein Service der vonBusch. Built with ♥ at Cloudflare.</p>
          {import.meta.env.DEV && (
            <div className="sr-only p-4 bg-accent text-xs">
              {t('utf8_test', 'Alfred-Bozi-Straße 12 – 33602 Bielefeld | Sichere dir 500€ Preisnachlass | Contrôle de Sécurité en 3 Minutes | Sécurité, confidentialité, accès € é ç ß ä ö ü')}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}