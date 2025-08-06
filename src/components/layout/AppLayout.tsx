import React, { ReactNode, useState } from 'react';
import Navigation from './Navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  sidebarWidth?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sidebarWidths = {
  sm: 'w-64',
  md: 'w-80', 
  lg: 'w-96'
};

const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  sidebar, 
  sidebarWidth = 'md',
  className 
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className={cn("flex h-[calc(100vh-4rem)]", className)}>
        {/* Desktop Sidebar */}
        {sidebar && (
          <aside className={cn(
            "flex-shrink-0 border-r bg-muted/10",
            sidebarWidths[sidebarWidth],
            "hidden lg:flex lg:flex-col"
          )}>
            <div className="flex-1 overflow-y-auto p-4">
              {sidebar}
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-hidden relative">
          {children}
          
          {/* Mobile Sidebar Trigger */}
          {sidebar && (
            <div className="lg:hidden">
              <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="fixed top-20 left-4 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 sm:w-96">
                  <div className="mt-6 overflow-y-auto h-full">
                    {sidebar}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;