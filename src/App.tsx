import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/common/ScrollToTop";

// Providers
import { AuthProvider } from "@/contexts/AuthContext";
import { TripPlannerProvider } from "@/contexts/TripPlannerContext";
import { QuizProvider } from "@/contexts/QuizContext";

// Layouts
import ProtectedRoute from "@/components/layout/ProtectedRoute";

// Pages - Public
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Destinations from "./pages/Destinations";
import DestinationDetail from "./pages/DestinationDetail";
import Guides from "./pages/Guides";
import GuideDetail from "./pages/GuideDetail";
import About from "./pages/About";
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

// Pages - Profile
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import Settings from "./pages/Settings";

// Pages - Trip Planning
import Planner from "./pages/planner/Planner";
import PlannerFlight from "./pages/planner/PlannerFlightEnhanced";
import PlannerHotel from "./pages/planner/PlannerHotelEnhanced";
import PlannerItinerary from "./pages/planner/PlannerItinerary";
import PlannerBooking from "./pages/planner/PlannerBooking";

// Pages - Trip Management
import TripDashboard from "./pages/TripDashboard";
import TripDetail from "./pages/TripDetail";
import TripConfirmation from "./pages/TripConfirmation";

// Pages - Itinerary
import ItineraryView from "./pages/ItineraryView";
import SampleItinerary from "./pages/SampleItinerary";

// Pages - Legal
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

// 404
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TripPlannerProvider>
        <QuizProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/destinations" element={<Destinations />} />
                <Route path="/destination/:slug" element={<DestinationDetail />} />
                <Route path="/guides" element={<Guides />} />
                <Route path="/guides/:slug" element={<GuideDetail />} />
                <Route path="/about" element={<About />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/press" element={<Press />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/help" element={<HelpCenter />} />
                <Route path="/sample-itinerary" element={<SampleItinerary />} />
                
                {/* Auth Routes */}
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Onboarding Routes */}
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/start" element={<Start />} />
                <Route path="/quiz" element={<Quiz />} />
                
                {/* Profile Routes - Open for testing */}
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/edit" element={<ProfileEdit />} />
                <Route path="/profile/settings" element={<Settings />} />
                
                {/* Trip Planning Routes - Open for testing */}
                <Route path="/planner" element={<Planner />} />
                <Route path="/planner/flight" element={<PlannerFlight />} />
                <Route path="/planner/hotel" element={<PlannerHotel />} />
                <Route path="/planner/itinerary" element={<PlannerItinerary />} />
                <Route path="/planner/booking" element={<PlannerBooking />} />
                
                {/* Trip Management Routes - Open for testing */}
                <Route path="/trip/dashboard" element={<TripDashboard />} />
                <Route path="/trip/:tripId" element={<TripDetail />} />
                <Route path="/trips/:tripId/confirmation" element={<TripConfirmation />} />
                
                {/* Itinerary Routes - Open for testing */}
                <Route path="/itinerary/:id" element={<ItineraryView />} />
                
                {/* Legal Routes */}
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                
                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </QuizProvider>
      </TripPlannerProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
