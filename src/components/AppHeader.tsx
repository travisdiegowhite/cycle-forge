import React from 'react';
import { Menu, File, Edit, View, Settings as SettingsIcon } from 'lucide-react';
import { SidebarTrigger } from './ui/sidebar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function AppHeader() {
  return (
    <header className="h-12 border-b border-border bg-background flex items-center px-4 gap-4">
      <SidebarTrigger className="h-8 w-8" />
      
      <div className="flex items-center gap-1">
        <span className="font-semibold text-lg text-foreground">Route Studio</span>
      </div>

      <nav className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-sm">
              File
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>New Route</DropdownMenuItem>
            <DropdownMenuItem>Open Route</DropdownMenuItem>
            <DropdownMenuItem>Save Route</DropdownMenuItem>
            <DropdownMenuItem>Export GPX</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-sm">
              Edit
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Add Waypoint</DropdownMenuItem>
            <DropdownMenuItem>Clear Route</DropdownMenuItem>
            <DropdownMenuItem>Reverse Route</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-sm">
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Elevation Profile</DropdownMenuItem>
            <DropdownMenuItem>Route Statistics</DropdownMenuItem>
            <DropdownMenuItem>Full Screen</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-sm">
              Settings
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Map Style</DropdownMenuItem>
            <DropdownMenuItem>Units</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm">
          Help
        </Button>
        <Button variant="default" size="sm">
          Share
        </Button>
      </div>
    </header>
  );
}