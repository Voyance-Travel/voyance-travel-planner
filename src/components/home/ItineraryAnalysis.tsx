import { motion } from 'framer-motion';
import { ArrowRight, RotateCcw, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

interface Issue {
  emoji: string;
  headline: string;
  detail: string;
  severity: 'critical' | 'warning' | 'suggestion';
}

interface ItineraryAnalysisProps {
  analysis: {
    destination: string | null;
    issues: Issue[];
    positives: string[];
    canFix: boolean;
  };
  onReset: () => void;
}

export default function ItineraryAnalysis({ analysis, onReset }: ItineraryAnalysisProps) {
  const navigate = useNavigate();
  const hasIssues = analysis.issues.length > 0;

  const handleFix = () => {
    if (analysis.destination) {
      navigate(`${ROUTES.START}?destination=${encodeURIComponent(analysis.destination)}`);
    } else {
      navigate(ROUTES.START);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-2xl mx-auto"
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl md:text-3xl font-serif font-normal mb-6 text-foreground"
      >
        {hasIssues ? "Here's the honest truth:" : "Actually, this looks pretty good."}
      </motion.h2>

      {/* Issues */}
      {hasIssues && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4 mb-8"
        >
          {analysis.issues.map((issue, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex gap-3 p-4 rounded-lg bg-muted/30"
            >
              <span className="text-xl shrink-0">{issue.emoji}</span>
              <div>
                <p className="font-medium text-foreground">{issue.headline}</p>
                <p className="text-sm text-muted-foreground mt-1">{issue.detail}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Positives */}
      {analysis.positives.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">
            What you got right
          </h3>
          <div className="space-y-2">
            {analysis.positives.map((positive, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                {positive}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        {hasIssues && analysis.canFix ? (
          <>
            <p className="text-foreground mb-4">Want us to fix it?</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={handleFix}
                size="lg"
                className="rounded-full px-8"
              >
                Build me a better version
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button
                onClick={onReset}
                variant="outline"
                size="lg"
                className="rounded-full px-8"
              >
                <RotateCcw className="mr-2 w-4 h-4" />
                Analyze another trip
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => navigate(ROUTES.START)}
              size="lg"
              className="rounded-full px-8"
            >
              Plan another trip
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button
              onClick={onReset}
              variant="outline"
              size="lg"
              className="rounded-full px-8"
            >
              <RotateCcw className="mr-2 w-4 h-4" />
              Analyze another trip
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
