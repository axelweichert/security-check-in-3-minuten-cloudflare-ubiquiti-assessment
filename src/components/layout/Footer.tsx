export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 mt-auto">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-muted-foreground text-sm">
        <div className="space-y-2">
          <p>von Busch GmbH �� Alfred-Bozi-Straße 12 – 33602 Bielefeld</p>
          <div className="space-x-4">
            <a href="#" className="hover:text-primary transition-colors">Impressum</a>
            <span>|</span>
            <a href="#" className="hover:text-primary transition-colors">Datenschutz</a>
          </div>
          <p>Ein Service der von Busch GmbH. Built with ♥ at Cloudflare.</p>
        </div>
      </div>
    </footer>
  );
}