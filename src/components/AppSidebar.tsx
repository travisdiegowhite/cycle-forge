import React from 'react';
import { Route, MapPin, Settings, FileText, Upload } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from './ui/sidebar';

const sidebarItems = [
  { title: 'Route Builder', url: '/', icon: Route },
  { title: 'Strava Routes', url: '/strava-routes', icon: MapPin },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar
      className={`${isCollapsed ? 'w-14' : 'w-60'} border-r border-border bg-card`}
      collapsible="icon"
    >
      <SidebarContent className="p-0">
        {/* User section */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-2 text-xs text-muted-foreground">
            {!isCollapsed && user?.email}
          </SidebarGroupLabel>
        </SidebarGroup>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-2 text-xs text-muted-foreground">
            {!isCollapsed && 'Navigation'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                          isActive ? 'bg-accent text-accent-foreground font-medium' : ''
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-2 text-xs text-muted-foreground">
            {!isCollapsed && 'Tools'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="px-4 py-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                    <FileText className="h-4 w-4" />
                    {!isCollapsed && 'Export GPX'}
                  </Button>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <div className="px-4 py-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                    <Upload className="h-4 w-4" />
                    {!isCollapsed && 'Import Route'}
                  </Button>
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sign out at bottom */}
        <div className="mt-auto p-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="w-full justify-start gap-2"
          >
            <Settings className="h-4 w-4" />
            {!isCollapsed && 'Sign Out'}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}