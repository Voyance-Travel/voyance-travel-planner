import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ScrollToTop } from "@/components/common/ScrollToTop";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { ConnectionRecoveryBanner } from "@/components/common/ConnectionRecoveryBanner";
import { useImagePreloader } from "@/hooks/useImagePreloader";

import { PageTransition } from '@/components/layout/PageTransition';
import { useJourneyStore } from '@/stores/journey-store';
import { MonthlyCreditsChecker } from '@/components/common/MonthlyCreditsChecker';
import { WelcomeBonusManager } from '@/components/common/WelcomeBonusManager';
import { SiteOnboardingTour } from '@/components/onboarding/SiteOnboardingTour';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { GlobalErrorHandler } from '@/components/common/GlobalErrorHandler';
import { OAuthReturnHandler } from '@/components/auth/OAuthReturnHandler';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { useAccessibilityClasses } from '@/hooks/useAccessibilityClasses';
import { useErrorTracker } from '@/hooks/useErrorTracker';

// Providers
import { AuthProvider } from "@/contexts/AuthContext";
import DNARecalcOnVisit from "@/components/system/DNARecalcOnVisit";
import { TripPlannerProvider } from "@/contexts/TripPlannerContext";
import { QuizProvider } from "@/contexts/QuizContext";
import { OutOfCreditsProvider } from "@/contexts/OutOfCreditsContext";
import { OutOfCreditsModal } from "@/components/checkout/OutOfCreditsModal";

// Layouts
import ProtectedRoute from "@/components/layout/ProtectedRoute";

// Eagerly loaded: landing + auth (frequent first-paint targets, kept small)
import Home from "./pages/Home";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";

// Route-level fallback for Suspense boundaries
import RouteFallback from "@/components/common/RouteFallback";

// Pages - Public (lazy)
const Explore = lazy(() => import("./pages/Explore"));
const Destinations = lazy(() => import("./pages/Destinations"));
const DestinationDetail = lazy(() => import("./pages/DestinationDetail"));
const Guides = lazy(() => import("./pages/Guides"));
const TravelTips = lazy(() => import("./pages/TravelTips"));
const GuideDetail = lazy(() => import("./pages/GuideDetail"));
const CommunityGuidePublic = lazy(() => import("./pages/CommunityGuidePublic"));
const FoundersGuideDetail = lazy(() => import("./pages/FoundersGuideDetail"));
const CommunityGuideDetail = lazy(() => import("./pages/CommunityGuideDetail"));
const About = lazy(() => import("./pages/About"));
const Archetypes = lazy(() => import("./pages/Archetypes"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Careers = lazy(() => import("./pages/Careers"));
const Press = lazy(() => import("./pages/Press"));
const Contact = lazy(() => import("./pages/Contact"));
const FAQ = lazy(() => import("./pages/FAQ"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));

// Pages - Auth (lazy, except SignIn/SignUp above)
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));

// Pages - Onboarding
const Welcome = lazy(() => import("./pages/Welcome"));
const Start = lazy(() => import("./pages/Start"));
const Quiz = lazy(() => import("./pages/Quiz"));
const OnboardConversation = lazy(() => import("./pages/OnboardConversation"));

// Pages - Profile
const Profile = lazy(() => import("./pages/Profile"));
const ProfileEdit = lazy(() => import("./pages/ProfileEdit"));
const Settings = lazy(() => import("./pages/Settings"));
const CreditsAndBilling = lazy(() => import("./pages/CreditsAndBilling"));

// Pages - Trip Planning
const MultiCityPlanner = lazy(() => import("./pages/planner/MultiCityPlanner"));
const PlannerSummary = lazy(() => import("./pages/planner/PlannerSummary"));
const PlannerItinerary = lazy(() => import("./pages/planner/PlannerItinerary"));
const PlannerBooking = lazy(() => import("./pages/planner/PlannerBooking"));

// Pages - Trip Management
const TripDashboard = lazy(() => import("./pages/TripDashboard"));
const TripDetail = lazy(() => import("./pages/TripDetail"));
const TripConfirmation = lazy(() => import("./pages/TripConfirmation"));

// Pages - Itinerary
const ItineraryView = lazy(() => import("./pages/ItineraryView"));
const SampleItinerary = lazy(() => import("./pages/SampleItinerary"));
const ActiveTrip = lazy(() => import("./pages/ActiveTrip"));
const TripRecap = lazy(() => import("./pages/TripRecap"));
const GuideBuilder = lazy(() => import("./pages/GuideBuilder"));
const TravelGuideBuilder = lazy(() => import("./pages/TravelGuideBuilder"));
const TravelGuideEditor = lazy(() => import("./pages/TravelGuideEditor"));
const PublicTravelGuide = lazy(() => import("./pages/PublicTravelGuide"));
const Demo = lazy(() => import("./pages/Demo"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const MyBlogs = lazy(() => import("./pages/MyBlogs"));

// Pages - Legal
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Pricing = lazy(() => import("./pages/Pricing"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));

// Admin (lazy — most users never visit)
const BulkImport = lazy(() => import("./pages/admin/BulkImport"));
const DataCleanup = lazy(() => import("./pages/admin/DataCleanup"));
const ImageCuration = lazy(() => import("./pages/admin/ImageCuration"));
const UnitEconomics = lazy(() => import("./pages/admin/UnitEconomics"));
const TestSuites = lazy(() => import("./pages/admin/TestSuites"));
const UserTracking = lazy(() => import("./pages/admin/UserTracking"));
const SessionExplorer = lazy(() => import("./pages/admin/SessionExplorer"));
const GenerationLogs = lazy(() => import("./pages/admin/GenerationLogs"));

// Agent CRM (lazy)
const AgentDashboard = lazy(() => import("./pages/agent/AgentDashboard"));
const AgentClients = lazy(() => import("./pages/agent/AgentClients"));
const ClientDetail = lazy(() => import("./pages/agent/ClientDetail"));
const AccountForm = lazy(() => import("./pages/agent/AccountForm"));
const AgentTrips = lazy(() => import("./pages/agent/AgentTrips"));
const TripForm = lazy(() => import("./pages/agent/TripForm"));
const AgentTasks = lazy(() => import("./pages/agent/AgentTasks"));
const TripWorkspace = lazy(() => import("./pages/agent/TripWorkspace"));
const TripShare = lazy(() => import("./pages/agent/TripShare"));
const ConsumerTripShare = lazy(() => import("./pages/ConsumerTripShare"));
const AgentSettings = lazy(() => import("./pages/agent/AgentSettings"));
const AgentDocuments = lazy(() => import("./pages/agent/AgentDocuments"));
const AgentPayouts = lazy(() => import("./pages/agent/AgentPayouts"));
const ClientIntakeForm = lazy(() => import("./pages/agent/ClientIntakeForm"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));

const queryClient = new QueryClient();


// Initialize APNs push notifications on native
function PushInitializer() {
  useEffect(() => {
    import('@/services/pushService').then(({ initPushNotifications }) => {
      initPushNotifications().catch(console.error);
    });
  }, []);
  return null;
}

// Component to initialize image preloading
function ImagePreloaderInit() {
  useImagePreloader();
  return null;
}

// Component to track page views for journey awareness + analytics
function JourneyTracker() {
  const location = useLocation();
  const trackPageView = useJourneyStore(state => state.trackPageView);
  const trackAction = useJourneyStore(state => state.trackAction);
  useAnalyticsTracker();
  useAccessibilityClasses();
  useErrorTracker();
  
  useEffect(() => {
    trackPageView(location.pathname);
    
    // Track demo view action
    if (location.pathname === '/demo') {
      trackAction('demo_viewed');
    }
  }, [location.pathname, trackPageView, trackAction]);
  
  return null;
}

// Routes wrapper — no opacity animation to prevent washed-out rendering
function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <PageTransition>
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location}>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/destinations" element={<Destinations />} />
          <Route path="/destination/:slug" element={<DestinationDetail />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/guides/:slug" element={<GuideDetail />} />
          <Route path="/community-guide/:slug" element={<CommunityGuidePublic />} />
          <Route path="/founders-guides/:slug" element={<FoundersGuideDetail />} />
          <Route path="/community-guides/:guideId" element={<CommunityGuideDetail />} />
          <Route path="/travel-tips" element={<TravelTips />} />
          <Route path="/about" element={<About />} />
          <Route path="/archetypes" element={<Archetypes />} />
          <Route path="/archetypes/:slug" element={<Archetypes />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/press" element={<Press />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/sample-itinerary" element={<SampleItinerary />} />

          {/* Public Blog */}
          <Route path="/blog/:slug" element={<BlogPost />} />

          {/* Public Share Routes */}
          <Route path="/share/:shareToken" element={<TripShare />} />
          <Route path="/trip-share/:token" element={<ConsumerTripShare />} />
          <Route path="/intake/:intakeToken" element={<ClientIntakeForm />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />

          {/* Auth Routes */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/sign-in" element={<Navigate to="/signin" replace />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/sign-up" element={<Navigate to="/signup" replace />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Onboarding Routes */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/start" element={
            <ProtectedRoute>
              <Start />
            </ProtectedRoute>
          } />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/onboard/conversation" element={<OnboardConversation />} />

          {/* Profile Routes */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/edit" element={<ProtectedRoute><ProfileEdit /></ProtectedRoute>} />
          <Route path="/profile/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/profile/credits" element={<ProtectedRoute><CreditsAndBilling /></ProtectedRoute>} />
          <Route path="/settings" element={<Navigate to="/profile/settings" replace />} />

          {/* Trip Planning Routes */}
          <Route path="/planner" element={<Navigate to="/start" replace />} />
          <Route path="/planner/multi-city" element={<ProtectedRoute><MultiCityPlanner /></ProtectedRoute>} />
          <Route path="/planner/hotel" element={<Navigate to="/start" replace />} />
          <Route path="/planner/summary" element={<ProtectedRoute><PlannerSummary /></ProtectedRoute>} />
          <Route path="/planner/itinerary" element={<ProtectedRoute><PlannerItinerary /></ProtectedRoute>} />
          <Route path="/planner/booking" element={<ProtectedRoute><PlannerBooking /></ProtectedRoute>} />

          {/* Legacy route redirects */}
          <Route path="/dashboard" element={<Navigate to="/trip/dashboard" replace />} />
          <Route path="/my-trips" element={<Navigate to="/trip/dashboard" replace />} />

          {/* Trip Management Routes */}
          <Route path="/trip/dashboard" element={<ProtectedRoute><TripDashboard /></ProtectedRoute>} />
          <Route path="/trip/:tripId" element={<ProtectedRoute><TripDetail /></ProtectedRoute>} />
          <Route path="/trip/:tripId/active" element={<ProtectedRoute><ActiveTrip /></ProtectedRoute>} />
          <Route path="/trip/:tripId/recap" element={<ProtectedRoute><TripRecap /></ProtectedRoute>} />
          <Route path="/trip/:tripId/guide" element={<ProtectedRoute><GuideBuilder /></ProtectedRoute>} />
          <Route path="/guide/create/:tripId" element={<ProtectedRoute><GuideBuilder /></ProtectedRoute>} />
          <Route path="/trip/:tripId/travel-guide" element={<ProtectedRoute><TravelGuideBuilder /></ProtectedRoute>} />
          <Route path="/trip/:tripId/travel-guide/edit/:guideId" element={<ProtectedRoute><TravelGuideEditor /></ProtectedRoute>} />
          <Route path="/guide/:slug" element={<PublicTravelGuide />} />
          <Route path="/trips/:tripId/confirmation" element={<TripConfirmation />} />

          {/* Blog Routes */}
          <Route path="/blog" element={<ProtectedRoute><MyBlogs /></ProtectedRoute>} />

          {/* Itinerary Routes */}
          <Route path="/itinerary/:id" element={<ItineraryView />} />

          {/* Legal Routes */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/legal/privacy" element={<Navigate to="/privacy" replace />} />
          <Route path="/legal/terms" element={<Navigate to="/terms" replace />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />

          {/* Admin Routes - Protected */}
          <Route path="/admin/bulk-import" element={<ProtectedRoute><BulkImport /></ProtectedRoute>} />
          <Route path="/admin/data-cleanup" element={<ProtectedRoute><DataCleanup /></ProtectedRoute>} />
          <Route path="/admin/image-curation" element={<ProtectedRoute><ImageCuration /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><UnitEconomics /></ProtectedRoute>} />
          <Route path="/admin/margins" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/test-suites" element={<ProtectedRoute><TestSuites /></ProtectedRoute>} />
          <Route path="/admin/user-tracking" element={<ProtectedRoute><UserTracking /></ProtectedRoute>} />
          <Route path="/admin/session-explorer" element={<ProtectedRoute><SessionExplorer /></ProtectedRoute>} />
          <Route path="/admin/logs" element={<ProtectedRoute><GenerationLogs /></ProtectedRoute>} />

          {/* Agent CRM Routes */}
          <Route path="/agent" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
          <Route path="/agent/clients" element={<ProtectedRoute><AgentClients /></ProtectedRoute>} />
          <Route path="/agent/clients/new" element={<ProtectedRoute><AccountForm /></ProtectedRoute>} />
          <Route path="/agent/clients/:clientId" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
          <Route path="/agent/clients/:clientId/edit" element={<ProtectedRoute><AccountForm /></ProtectedRoute>} />
          <Route path="/agent/trips" element={<ProtectedRoute><AgentTrips /></ProtectedRoute>} />
          <Route path="/agent/trips/new" element={<ProtectedRoute><TripForm /></ProtectedRoute>} />
          <Route path="/agent/trips/:tripId" element={<ProtectedRoute><TripWorkspace /></ProtectedRoute>} />
          <Route path="/agent/trips/:tripId/edit" element={<ProtectedRoute><TripForm /></ProtectedRoute>} />
          <Route path="/agent/tasks" element={<ProtectedRoute><AgentTasks /></ProtectedRoute>} />
          <Route path="/agent/library" element={<Navigate to="/agent" replace />} />
          <Route path="/agent/settings" element={<ProtectedRoute><AgentSettings /></ProtectedRoute>} />
          <Route path="/agent/documents" element={<ProtectedRoute><AgentDocuments /></ProtectedRoute>} />
          <Route path="/agent/payouts" element={<ProtectedRoute><AgentPayouts /></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </PageTransition>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TripPlannerProvider>
        <QuizProvider>
          <OutOfCreditsProvider>
            <TooltipProvider>
              <ImagePreloaderInit />
              
              <PushInitializer />
              <GlobalErrorHandler />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <OfflineBanner />
                <ConnectionRecoveryBanner />
                
                <ScrollToTop />
                <JourneyTracker />
                <MonthlyCreditsChecker />
                <WelcomeBonusManager />
                <SiteOnboardingTour />
                <OAuthReturnHandler />
                <DNARecalcOnVisit />
                <OutOfCreditsModal />
                <ErrorBoundary>
                  <AnimatedRoutes />
                </ErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
          </OutOfCreditsProvider>
        </QuizProvider>
      </TripPlannerProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
