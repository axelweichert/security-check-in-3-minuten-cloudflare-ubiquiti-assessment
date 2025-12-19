import React from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Footer } from "./Footer";

type AppLayoutProps = {
  children: React.ReactNode;
  container?: boolean;
  className?: string;
  contentClassName?: string;
};

export function AppLayout({ children, container = false, className, contentClassName }: AppLayoutProps): JSX.Element {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className={className}>
        <div className="absolute left-2 top-2 z-20">
          <SidebarTrigger />
        </div>

        <div className="flex flex-col min-h-screen">
          <main className="flex-grow">
            {container ? (
              <div
                className={
                  "max-w-7xl mx-auto px-6 sm:px-6 lg:px-8 py-8 md:py-10 lg:py-12" +
                  (contentClassName ? ` ${contentClassName}` : "")
                }
              >
                {children}
              </div>
            ) : (
              children
            )}
          </main>

          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
