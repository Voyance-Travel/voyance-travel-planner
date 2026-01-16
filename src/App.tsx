import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import DestinationDetail from "./pages/DestinationDetail";
import SignIn from "./pages/SignIn";
import Profile from "./pages/Profile";
import TripPlanner from "./pages/TripPlanner";
import StartPlanning from "./pages/StartPlanning";
import ItineraryPage from "./pages/ItineraryPage";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/destinations/:id" element={<DestinationDetail />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/trip/new" element={<StartPlanning />} />
          <Route path="/trip/:tripId" element={<TripPlanner />} />
          <Route path="/trip/:tripId/itinerary" element={<ItineraryPage />} />
          <Route path="/sample-itinerary" element={<ItineraryPage />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
