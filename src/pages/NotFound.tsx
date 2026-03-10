import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { strangerCopy } from "@/lib/strangerCopy";
import { ROUTES } from "@/config/routes";

const NotFound = () => {
  const location = useLocation();
  const { notFound } = strangerCopy;

  useEffect(() => {
    console.warn("[404] Route not found:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center px-8 max-w-md"
      >
        {/* Visual indicator */}
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🧭</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl md:text-4xl font-serif font-normal text-foreground mb-3">
          {notFound.headline}
        </h1>
        
        {/* Subhead */}
        <p className="text-lg text-muted-foreground mb-8">
          {notFound.subhead}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="font-sans">
            <Link to={ROUTES.QUIZ}>
              {notFound.ctaQuiz}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg" className="font-sans">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              {notFound.ctaHome}
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
