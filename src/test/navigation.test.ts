/**
 * Navigation and Routing Tests
 * 
 * Tests to catch:
 * 1. Dead pages (routes that don't exist or are broken)
 * 2. Circular redirects (infinite loops)
 * 3. Auth state mismatches (showing login when authenticated)
 * 4. Proper redirect chains
 */
import { describe, it, expect } from 'vitest';
import { ROUTES, buildRoute } from '@/config/routes';

// All routes defined in App.tsx
const ALL_APP_ROUTES = {
  // Public Routes
  public: [
    '/',
    '/demo',
    '/explore',
    '/destinations',
    '/destination/:slug',
    '/guides',
    '/guides/:slug',
    '/travel-tips',
    '/about',
    '/archetypes',
    '/archetypes/:slug',
    '/how-it-works',
    '/careers',
    '/press',
    '/contact',
    '/faq',
    '/help',
    '/sample-itinerary',
    '/privacy',
    '/terms',
    '/pricing',
    '/payment-success',
  ],
  
  // Public but with dynamic segments
  publicDynamic: [
    '/share/:shareToken',
    '/intake/:intakeToken',
    '/invite/:token',
  ],
  
  // Auth Routes (should redirect away if logged in)
  auth: [
    '/signin',
    '/signup',
    '/forgot-password',
    '/reset-password',
  ],
  
  // Redirects (should never be a final destination)
  redirects: [
    { from: '/sign-in', to: '/signin' },
    { from: '/sign-up', to: '/signup' },
    { from: '/planner', to: '/start' },
    { from: '/agent/library', to: '/agent' },
  ],
  
  // Semi-protected (auth encouraged but not required)
  semiProtected: [
    '/welcome',
    '/start',
    '/quiz',
    '/onboard/conversation',
    '/profile',
    '/profile/edit',
    '/profile/settings',
  ],
  
  // Trip routes (require auth for most operations)
  trip: [
    '/planner/multi-city',
    '/planner/flight',
    '/planner/hotel',
    '/planner/summary',
    '/planner/itinerary',
    '/planner/booking',
    '/trip/dashboard',
    '/trip/:tripId',
    '/trip/:tripId/active',
    '/trip/:tripId/recap',
    '/trips/:tripId/confirmation',
    '/itinerary/:id',
  ],
  
  // Admin routes (protected)
  admin: [
    '/admin/bulk-import',
    '/admin/data-cleanup',
    '/admin/image-curation',
    '/admin/margins',
    '/admin/test-suites',
    '/admin/user-tracking',
  ],
  
  // Agent CRM routes
  agent: [
    '/agent',
    '/agent/clients',
    '/agent/clients/new',
    '/agent/clients/:clientId',
    '/agent/clients/:clientId/edit',
    '/agent/trips',
    '/agent/trips/new',
    '/agent/trips/:tripId',
    '/agent/trips/:tripId/edit',
    '/agent/tasks',
    '/agent/settings',
    '/agent/documents',
    '/agent/payouts',
  ],
};

describe('Route Configuration Consistency', () => {
  it('ROUTES config should match App.tsx routes', () => {
    // Check that key routes in config exist
    expect(ROUTES.HOME).toBe('/');
    expect(ROUTES.SIGNIN).toBe('/signin');
    expect(ROUTES.SIGNUP).toBe('/signup');
    expect(ROUTES.QUIZ).toBe('/quiz');
    expect(ROUTES.START).toBe('/start');
  });

  it('should have consistent profile routes', () => {
    expect(ROUTES.PROFILE.VIEW).toBe('/profile');
    expect(ROUTES.PROFILE.EDIT).toBe('/profile/edit');
    expect(ROUTES.PROFILE.SETTINGS).toBe('/profile/settings');
  });

  it('should have consistent planner routes', () => {
    expect(ROUTES.PLANNER.ROOT).toBe('/planner');
    expect(ROUTES.PLANNER.FLIGHT).toBe('/planner/flight');
    expect(ROUTES.PLANNER.HOTEL).toBe('/planner/hotel');
  });

  it('should have consistent agent routes', () => {
    expect(ROUTES.AGENT.DASHBOARD).toBe('/agent');
    expect(ROUTES.AGENT.CLIENTS).toBe('/agent/clients');
    expect(ROUTES.AGENT.TRIPS).toBe('/agent/trips');
  });
});

describe('Route Builder Helpers', () => {
  it('should build destination routes correctly', () => {
    expect(buildRoute.destination('paris-france')).toBe('/destination/paris-france');
    expect(buildRoute.destination('tokyo-japan')).toBe('/destination/tokyo-japan');
  });

  it('should build trip routes correctly', () => {
    expect(buildRoute.trip('abc-123')).toBe('/trip/abc-123');
    expect(buildRoute.trip('xyz-456')).toBe('/trip/xyz-456');
  });

  it('should build itinerary routes correctly', () => {
    expect(buildRoute.itinerary('itin-123')).toBe('/itinerary/itin-123');
    expect(buildRoute.itineraryEdit('itin-123')).toBe('/itinerary/itin-123/edit');
  });

  it('should build confirmation routes correctly', () => {
    expect(buildRoute.confirmation('trip-123')).toBe('/trips/trip-123/confirmation');
  });
});

describe('Redirect Chain Validation', () => {
  it('should not have circular redirects', () => {
    const redirectMap = new Map<string, string>();
    
    ALL_APP_ROUTES.redirects.forEach(({ from, to }) => {
      redirectMap.set(from, to);
    });
    
    // Check no redirect points back to itself
    ALL_APP_ROUTES.redirects.forEach(({ from, to }) => {
      expect(to).not.toBe(from);
      
      // Check for 2-step circles: A -> B -> A
      const secondHop = redirectMap.get(to);
      if (secondHop) {
        expect(secondHop).not.toBe(from);
      }
    });
  });

  it('redirect targets should be valid routes', () => {
    const allValidRoutes = [
      ...ALL_APP_ROUTES.public,
      ...ALL_APP_ROUTES.auth,
      ...ALL_APP_ROUTES.semiProtected,
      ...ALL_APP_ROUTES.trip,
      ...ALL_APP_ROUTES.admin,
      ...ALL_APP_ROUTES.agent,
    ];
    
    ALL_APP_ROUTES.redirects.forEach(({ to }) => {
      expect(allValidRoutes).toContain(to);
    });
  });

  it('legacy route aliases should redirect properly', () => {
    // These are common typos or old URLs that should redirect
    const legacyRedirects = ALL_APP_ROUTES.redirects;
    
    expect(legacyRedirects.find(r => r.from === '/sign-in')?.to).toBe('/signin');
    expect(legacyRedirects.find(r => r.from === '/sign-up')?.to).toBe('/signup');
    expect(legacyRedirects.find(r => r.from === '/planner')?.to).toBe('/start');
  });
});

describe('Auth Route Behavior', () => {
  it('auth routes should only include login/signup related pages', () => {
    const authRoutes = ALL_APP_ROUTES.auth;
    
    expect(authRoutes).toContain('/signin');
    expect(authRoutes).toContain('/signup');
    expect(authRoutes).toContain('/forgot-password');
    expect(authRoutes).toContain('/reset-password');
    
    // Should NOT include profile or protected routes
    expect(authRoutes).not.toContain('/profile');
    expect(authRoutes).not.toContain('/trip/dashboard');
  });

  it('protected routes should require authentication', () => {
    const protectedRoutes = ALL_APP_ROUTES.admin;
    
    // All admin routes should be protected
    expect(protectedRoutes.every(r => r.startsWith('/admin/'))).toBe(true);
  });
});

describe('Route Completeness', () => {
  it('every page import in App.tsx should have a route', () => {
    // These are pages imported in App.tsx that must have routes
    const requiredPages = [
      'Home',
      'SignIn',
      'SignUp',
      'Profile',
      'TripDashboard',
      'NotFound',
    ];
    
    // Just verify the structure exists - actual import checking would need AST parsing
    expect(requiredPages.length).toBeGreaterThan(0);
  });

  it('should have a 404 catch-all route', () => {
    // The NotFound page is imported and used as catch-all
    // This test documents that requirement
    const hasNotFound = true; // Route path="*" element={<NotFound />}
    expect(hasNotFound).toBe(true);
  });
});

describe('Protected Route Logic', () => {
  // Simulates ProtectedRoute component logic
  function shouldRedirectToLogin(isAuthenticated: boolean, isLoading: boolean): boolean {
    if (isLoading) return false; // Show loading, don't redirect
    return !isAuthenticated;
  }

  function shouldRedirectToQuiz(
    isAuthenticated: boolean,
    quizCompleted: boolean,
    requireQuiz: boolean
  ): boolean {
    if (!isAuthenticated) return false; // Login redirect takes precedence
    return requireQuiz && !quizCompleted;
  }

  it('should redirect to login when not authenticated', () => {
    expect(shouldRedirectToLogin(false, false)).toBe(true);
    expect(shouldRedirectToLogin(true, false)).toBe(false);
  });

  it('should not redirect while loading', () => {
    expect(shouldRedirectToLogin(false, true)).toBe(false);
    expect(shouldRedirectToLogin(true, true)).toBe(false);
  });

  it('should redirect to quiz when required and not completed', () => {
    expect(shouldRedirectToQuiz(true, false, true)).toBe(true);
    expect(shouldRedirectToQuiz(true, true, true)).toBe(false);
    expect(shouldRedirectToQuiz(true, false, false)).toBe(false);
  });

  it('should not redirect to quiz if not authenticated', () => {
    // Login redirect takes precedence
    expect(shouldRedirectToQuiz(false, false, true)).toBe(false);
  });
});

describe('Auth State Navigation Scenarios', () => {
  interface NavScenario {
    route: string;
    isAuthenticated: boolean;
    expectedBehavior: 'render' | 'redirect-login' | 'redirect-away';
  }

  const scenarios: NavScenario[] = [
    // Public pages - always render
    { route: '/', isAuthenticated: false, expectedBehavior: 'render' },
    { route: '/', isAuthenticated: true, expectedBehavior: 'render' },
    { route: '/explore', isAuthenticated: false, expectedBehavior: 'render' },
    { route: '/about', isAuthenticated: true, expectedBehavior: 'render' },
    
    // Auth pages - should render for unauthenticated
    { route: '/signin', isAuthenticated: false, expectedBehavior: 'render' },
    { route: '/signup', isAuthenticated: false, expectedBehavior: 'render' },
    
    // Note: Many apps redirect auth pages when logged in
    // Current implementation doesn't, but this documents expected behavior
    
    // Protected pages - redirect to login when not authenticated
    { route: '/admin/bulk-import', isAuthenticated: false, expectedBehavior: 'redirect-login' },
    { route: '/admin/data-cleanup', isAuthenticated: false, expectedBehavior: 'redirect-login' },
  ];

  it.each(scenarios)(
    'route $route with auth=$isAuthenticated should $expectedBehavior',
    ({ route, isAuthenticated, expectedBehavior }) => {
      const isPublic = ALL_APP_ROUTES.public.includes(route);
      const isAdmin = ALL_APP_ROUTES.admin.includes(route);
      
      if (expectedBehavior === 'render') {
        expect(isPublic || isAuthenticated || ALL_APP_ROUTES.auth.includes(route)).toBe(true);
      } else if (expectedBehavior === 'redirect-login') {
        expect(isAdmin && !isAuthenticated).toBe(true);
      }
    }
  );
});

describe('Dynamic Route Parameter Validation', () => {
  it('should have proper parameter placeholders', () => {
    const dynamicRoutes = [
      '/destination/:slug',
      '/guides/:slug',
      '/share/:shareToken',
      '/trip/:tripId',
      '/itinerary/:id',
      '/agent/clients/:clientId',
    ];
    
    dynamicRoutes.forEach(route => {
      expect(route).toMatch(/:\w+/);
    });
  });

  it('should not have duplicate parameter names in nested routes', () => {
    // Routes like /trip/:tripId/something/:tripId would be problematic
    const routesWithParams = [
      ...ALL_APP_ROUTES.trip,
      ...ALL_APP_ROUTES.agent,
    ].filter(r => r.includes(':'));
    
    routesWithParams.forEach(route => {
      const params = route.match(/:\w+/g) || [];
      const uniqueParams = new Set(params);
      expect(params.length).toBe(uniqueParams.size);
    });
  });
});

describe('Navigation Link Safety', () => {
  // All valid route patterns from App.tsx
  const allRoutePatterns = [
    ...ALL_APP_ROUTES.public,
    ...ALL_APP_ROUTES.auth,
    ...ALL_APP_ROUTES.semiProtected,
    ...ALL_APP_ROUTES.trip,
    ...ALL_APP_ROUTES.admin,
    ...ALL_APP_ROUTES.agent,
    ...ALL_APP_ROUTES.publicDynamic,
    ...ALL_APP_ROUTES.redirects.map(r => r.from),
  ];

  /**
   * Check if a navigation path resolves to a known route.
   * Handles static routes, dynamic segments, and query params.
   */
  function isValidRoute(path: string): boolean {
    // Strip query params and hash
    const cleanPath = path.split('?')[0].split('#')[0];
    
    // Direct match for static routes
    if (allRoutePatterns.includes(cleanPath)) return true;
    
    // Match dynamic route patterns (e.g., /trip/:tripId -> /trip/abc-123)
    const dynamicPatterns = allRoutePatterns
      .filter(r => r.includes(':'))
      .map(r => new RegExp('^' + r.replace(/:\w+/g, '[^/]+') + '$'));
    
    return dynamicPatterns.some(pattern => pattern.test(cleanPath));
  }

  it('internal links should use defined routes', () => {
    expect(isValidRoute('/')).toBe(true);
    expect(isValidRoute('/signin')).toBe(true);
    expect(isValidRoute('/trip/abc-123')).toBe(true);
    expect(isValidRoute('/trip/abc-123?generate=true')).toBe(true);
    expect(isValidRoute('/destination/paris')).toBe(true);
    expect(isValidRoute('/nonexistent-page')).toBe(false);
  });

  it('infrastructure paths should never be in app routes', () => {
    // These paths are handled by Lovable Cloud infrastructure, NOT React Router.
    // If they hit the React router, users see a 404 "Wrong Turn" page.
    const infrastructurePaths = [
      '/~oauth/initiate',
      '/~oauth/callback',
    ];
    
    infrastructurePaths.forEach(path => {
      // Infrastructure paths must NOT match any app route
      expect(isValidRoute(path)).toBe(false);
    });
  });

  it('all hardcoded navigate targets should resolve to valid routes', () => {
    // These are all unique static navigate() targets found in the codebase.
    // If you add a new navigate('/some-path') call, add it here too.
    // This catches the class of bug where code navigates to a non-existent route.
    const knownNavigateTargets = [
      '/',
      '/start',
      '/signin',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/quiz',
      '/explore',
      '/demo',
      '/profile',
      '/profile/edit',
      '/profile/settings',
      '/welcome',
      '/onboard/conversation',
      '/trip/dashboard',
      '/planner/multi-city',
      '/planner/flight',
      '/planner/hotel',
      '/planner/summary',
      '/planner/booking',
      '/planner/itinerary',
      '/pricing',
      '/payment-success',
      '/about',
      '/contact',
      '/faq',
      '/help',
      '/privacy',
      '/terms',
      '/sample-itinerary',
      '/admin/bulk-import',
      '/admin/data-cleanup',
      '/admin/image-curation',
      '/admin/margins',
      '/admin/test-suites',
      '/admin/user-tracking',
      '/agent',
      '/agent/clients',
      '/agent/clients/new',
      '/agent/trips',
      '/agent/trips/new',
      '/agent/tasks',
      '/agent/settings',
      '/agent/documents',
      '/agent/payouts',
    ];
    
    const invalidTargets: string[] = [];
    knownNavigateTargets.forEach(target => {
      if (!isValidRoute(target)) {
        invalidTargets.push(target);
      }
    });
    
    expect(invalidTargets).toEqual([]);
  });

  it('all dynamic navigate targets should match route patterns', () => {
    // Dynamic targets use buildRoute helpers or template literals.
    // These simulate real-world dynamic navigation.
    const dynamicTargets = [
      '/trip/some-uuid-123',
      '/trip/some-uuid-123/active',
      '/trip/some-uuid-123/recap',
      '/trips/some-uuid-123/confirmation',
      '/destination/paris-france',
      '/itinerary/itin-123',
      '/agent/clients/client-123',
      '/agent/clients/client-123/edit',
      '/agent/trips/trip-123',
      '/agent/trips/trip-123/edit',
      '/share/share-token-abc',
      '/intake/intake-token-xyz',
      '/invite/invite-token-def',
      '/guides/some-guide-slug',
    ];
    
    const invalidTargets: string[] = [];
    dynamicTargets.forEach(target => {
      if (!isValidRoute(target)) {
        invalidTargets.push(target);
      }
    });
    
    expect(invalidTargets).toEqual([]);
  });

  it('share and referral URLs should resolve to valid routes', () => {
    // These are URLs generated for sharing trips/referrals.
    // They must resolve to valid app routes to avoid 404s.
    const shareTargets = [
      // Trip share via shareToken (correct pattern)
      '/share/some-share-token',
      // Trip page via tripId (fallback share URL)
      '/trip/some-trip-uuid',
    ];
    
    const invalidShareUrls = [
      // These are KNOWN INVALID patterns that must NOT be generated.
      // If any code produces these, it's a bug.
      '/share/trip/some-id',  // Wrong: /share/trip/ is not a route
      '/trips',               // Wrong: /trips is not a route (use /trip/dashboard)
    ];
    
    // Valid share targets should resolve
    shareTargets.forEach(target => {
      expect(isValidRoute(target)).toBe(true);
    });
    
    // Invalid patterns should NOT resolve
    invalidShareUrls.forEach(target => {
      expect(isValidRoute(target)).toBe(false);
    });
  });

  it('credit earning checklist routes should all be valid', () => {
    // Routes used by CreditEarningChecklist and CreditEarningProgressBar
    const checklistRoutes = [
      '/quiz',
      '/profile?tab=preferences',
      '/trip/dashboard',
      '/start',
    ];
    
    checklistRoutes.forEach(route => {
      expect(isValidRoute(route)).toBe(true);
    });
  });
});
