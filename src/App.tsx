import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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
import About from "./pages/About";
import HowItWorks from "./pages/HowItWorks";
import Careers from "./pages/Careers";
import Press from "./pages/Press";

// Pages - Auth
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";

// Pages - Onboarding
import Welcome from "./pages/Welcome";
import Start from "./pages/Start";
import Quiz from "./pages/Quiz";

// Pages - Profile
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";

// Pages - Trip Planning
import Planner from "./pages/planner/Planner";
import PlannerFlight from "./pages/planner/PlannerFlight";
import PlannerHotel from "./pages/planner/PlannerHotel";
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
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/destinations" element={<Destinations />} />
                <Route path="/destination/:slug" element={<DestinationDetail />} />
                <Route path="/about" element={<About />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/press" element={<Press />} />
                <Route path="/sample-itinerary" element={<SampleItinerary />} />
                
                {/* Auth Routes */}
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                
                {/* Onboarding Routes */}
                <Route path="/welcome" element={
                  <ProtectedRoute>
                    <Welcome />
                  </ProtectedRoute>
                } />
                <Route path="/start" element={<Start />} />
                <Route path="/quiz" element={
                  <ProtectedRoute>
                    <Quiz />
                  </ProtectedRoute>
                } />
                
                {/* Profile Routes */}
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/profile/edit" element={
                  <ProtectedRoute>
                    <ProfileEdit />
                  </ProtectedRoute>
                } />
                
                {/* Trip Planning Routes */}
                <Route path="/planner" element={
                  <ProtectedRoute>
                    <Planner />
                  </ProtectedRoute>
                } />
                <Route path="/planner/flight" element={
                  <ProtectedRoute>
                    <PlannerFlight />
                  </ProtectedRoute>
                } />
                <Route path="/planner/hotel" element={
                  <ProtectedRoute>
                    <PlannerHotel />
                  </ProtectedRoute>
                } />
                <Route path="/planner/itinerary" element={
                  <ProtectedRoute>
                    <PlannerItinerary />
                  </ProtectedRoute>
                } />
                <Route path="/planner/booking" element={
                  <ProtectedRoute>
                    <PlannerBooking />
                  </ProtectedRoute>
                } />
                
                {/* Trip Management Routes */}
                <Route path="/trip/dashboard" element={
                  <ProtectedRoute>
                    <TripDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/trip/:tripId" element={
                  <ProtectedRoute>
                    <TripDetail />
                  </ProtectedRoute>
                } />
                <Route path="/trips/:tripId/confirmation" element={
                  <ProtectedRoute>
                    <TripConfirmation />
                  </ProtectedRoute>
                } />
                
                {/* Itinerary Routes */}
                <Route path="/itinerary/:id" element={
                  <ProtectedRoute>
                    <ItineraryView />
                  </ProtectedRoute>
                } />
                
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
