import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AgentBreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export default function AgentBreadcrumb({ items = [], className }: AgentBreadcrumbProps) {
  const location = useLocation();
  
  // Auto-generate breadcrumbs from path if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [];
    
    pathParts.forEach((part, index) => {
      const href = '/' + pathParts.slice(0, index + 1).join('/');
      
      // Skip UUID-like segments in label but include in href
      if (part.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i)) {
        return;
      }
      
      // Format label
      let label = part.charAt(0).toUpperCase() + part.slice(1);
      label = label.replace(/-/g, ' ');
      
      // Special case mappings
      if (part === 'agent') label = 'Dashboard';
      if (part === 'clients') label = 'Clients';
      if (part === 'trips') label = 'Trips';
      if (part === 'tasks') label = 'Tasks';
      if (part === 'documents') label = 'Documents';
      if (part === 'new') label = 'New';
      if (part === 'edit') label = 'Edit';
      
      crumbs.push({ label, href });
    });
    
    return crumbs;
  };
  
  const breadcrumbs = items.length > 0 ? items : generateBreadcrumbs();
  
  if (breadcrumbs.length <= 1) return null;
  
  return (
    <nav className={cn("flex items-center gap-1 text-sm text-muted-foreground mb-4", className)}>
      <Link 
        to="/agent" 
        className="hover:text-foreground transition-colors flex items-center gap-1"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Dashboard</span>
      </Link>
      
      {breadcrumbs.slice(1).map((crumb, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          {crumb.href && index < breadcrumbs.length - 2 ? (
            <Link 
              to={crumb.href}
              className="hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium truncate max-w-[200px]">
              {crumb.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
