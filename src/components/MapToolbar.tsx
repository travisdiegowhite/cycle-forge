import React from 'react';
import { 
  Map,
  Route,
  Navigation,
  Target,
  Layers,
  Search,
  Info
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

export function MapToolbar() {
  return (
    <TooltipProvider>
      {/* Left side toolbar */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
        <div className="flex flex-col gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-1 shadow-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                <Route className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Route Planning</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                <Target className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Add Waypoint</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                <Navigation className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Navigation</TooltipContent>
          </Tooltip>
          
          <div className="w-full h-px bg-border my-1" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                <Search className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Search</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                <Info className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Route Info</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Right side toolbar */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
        <div className="flex flex-col gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-1 shadow-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                <Map className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Map Style</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                <Layers className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Layers</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}