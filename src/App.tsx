import { useEffect } from 'react';
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
import { TripPlannerProvider } from "@/contexts/TripPlannerContext";
import { QuizProvider } from "@/contexts/QuizContext";
import { OutOfCreditsProvider } from "@/contexts/OutOfCreditsContext";
import { OutOfCreditsModal } from "@/components/checkout/OutOfCreditsModal";

// Layouts
import ProtectedRoute from "@/components/layout/ProtectedRoute";

// Pages - Public
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Destinations from "./pages/Destinations";
import DestinationDetail from "./pages/DestinationDetail";
import Guides from "./pages/Guides";
import TravelTips from "./pages/TravelTips";
import GuideDetail from "./pages/GuideDetail";
import CommunityGuidePublic from "./pages/CommunityGuidePublic";
import FoundersGuideDetail from "./pages/FoundersGuideDetail";
import CommunityGuideDetail from "./pages/CommunityGuideDetail";
import About from "./pages/About";
import Archetypes from "./pages/Archetypes";
import HowItWorks from "./pages/HowItWorks";
import Careers from "./pages/Careers";
import Press from "./pages/Press";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import HelpCenter from "./pages/HelpCenter";

// Pages - Auth
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";

// Pages - Onboarding
import Welcome from "./pages/Welcome";
import Start from "./pages/Start";
import Quiz from "./pages/Quiz";
import OnboardConversation from "./pages/OnboardConversation";

// Pages - Profile
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import Settings from "./pages/Settings";
import CreditsAndBilling from "./pages/CreditsAndBilling";

// Pages - Trip Planning
import MultiCityPlanner from "./pages/planner/MultiCityPlanner";
import PlannerFlight from "./pages/planner/PlannerFlightEnhanced";
import PlannerHotel from "./pages/planner/PlannerHotelEnhanced";
import PlannerSummary from "./pages/planner/PlannerSummary";
import PlannerItinerary from "./pages/planner/PlannerItinerary";
import PlannerBooking from "./pages/planner/PlannerBooking";

// Pages - Trip Management
import TripDashboard from "./pages/TripDashboard";
import TripDetail from "./pages/TripDetail";
import TripConfirmation from "./pages/TripConfirmation";

// Pages - Itinerary
import ItineraryView from "./pages/ItineraryView";
import SampleItinerary from "./pages/SampleItinerary";
import ActiveTrip from "./pages/ActiveTrip";
import TripRecap from "./pages/TripRecap";
import GuideBuilder from "./pages/GuideBuilder";
import TravelGuideBuilder from "./pages/TravelGuideBuilder";
import TravelGuideEditor from "./pages/TravelGuideEditor";
import PublicTravelGuide from "./pages/PublicTravelGuide";
import Demo from "./pages/Demo";
import BlogPost from "./pages/BlogPost";
import MyBlogs from "./pages/MyBlogs";

// Pages - Legal
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Pricing from "./pages/Pricing";
import PaymentSuccess from "./pages/PaymentSuccess";

// Admin
import BulkImport from "./pages/admin/BulkImport";
import DataCleanup from "./pages/admin/DataCleanup";
import ImageCuration from "./pages/admin/ImageCuration";
import UnitEconomics from "./pages/admin/UnitEconomics";
import TestSuites from "./pages/admin/TestSuites";
import UserTracking from "./pages/admin/UserTracking";
import SessionExplorer from "./pages/admin/SessionExplorer";
import GenerationLogs from "./pages/admin/GenerationLogs";

// Agent CRM
import AgentDashboard from "./pages/agent/AgentDashboard";
import AgentClients from "./pages/agent/AgentClients";
import ClientDetail from "./pages/agent/ClientDetail";
import AccountForm from "./pages/agent/AccountForm";
import AgentTrips from "./pages/agent/AgentTrips";
import TripForm from "./pages/agent/TripForm";
import AgentTasks from "./pages/agent/AgentTasks";
import TripWorkspace from "./pages/agent/TripWorkspace";
import TripShare from "./pages/agent/TripShare";
import ConsumerTripShare from "./pages/ConsumerTripShare";
import AgentSettings from "./pages/agent/AgentSettings";
import AgentDocuments from "./pages/agent/AgentDocuments";
import AgentPayouts from "./pages/agent/AgentPayouts";
import ClientIntakeForm from "./pages/agent/ClientIntakeForm";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";

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
        <Route path="/planner/flight" element={<ProtectedRoute><PlannerFlight /></ProtectedRoute>} />
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
