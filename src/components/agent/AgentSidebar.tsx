import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Plane, 
  CheckSquare, 
  FileText,
  ChevronRight,
  Building2,
  Menu,
  X,
  Library,
  Banknote
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/agent', icon: LayoutDashboard },
  { label: 'Clients', href: '/agent/clients', icon: Users },
  { label: 'Trips', href: '/agent/trips', icon: Plane },
  { label: 'Tasks', href: '/agent/tasks', icon: CheckSquare },
  { label: 'Library', href: '/agent/library', icon: Library },
  { label: 'Documents', href: '/agent/documents', icon: FileText },
];

const bottomNavItems: NavItem[] = [
  { label: 'Payouts', href: '/agent/payouts', icon: Banknote },
  { label: 'Agency Settings', href: '/agent/settings', icon: Building2 },
];

interface AgentSidebarProps {
  taskCount?: number;
}

function NavContent({ taskCount, onNavigate }: { taskCount?: number; onNavigate?: () => void }) {
  const location = useLocation();
  
  const isActive = (href: string) => {
    if (href === '/agent') {
      return location.pathname === '/agent';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="flex-1">{item.label}</span>
            {item.label === 'Tasks' && taskCount && taskCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5">
                {taskCount}
              </Badge>
            )}
            {isActive(item.href) && (
              <ChevronRight className="h-4 w-4" />
            )}
          </Link>
        ))}
      </nav>
      
      <div className="p-4 border-t">
        {bottomNavItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function AgentSidebar({ taskCount }: AgentSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button - Fixed position */}
      <div className="lg:hidden fixed bottom-4 left-4 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-lg">Agent Tools</h2>
              </div>
              <NavContent taskCount={taskCount} onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r bg-card min-h-[calc(100vh-4rem)] sticky top-16">
        <NavContent taskCount={taskCount} />
      </aside>
    </>
  );
}
