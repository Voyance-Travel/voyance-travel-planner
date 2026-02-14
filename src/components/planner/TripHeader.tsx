import { MapPin, Calendar, Users, Share2, Route, RefreshCw, Lock } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from '@/utils/dateUtils';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TripHeaderProps {
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  className?: string;
  // Optional action props
  showLocalCurrency?: boolean;
  localCurrency?: string;
  onCurrencyToggle?: () => void;
  onShare?: () => void;
  onOptimize?: () => void;
  isOptimizing?: boolean;
  canOptimize?: boolean;
  showOptimizeLock?: boolean;
}

export const TripHeader: React.FC<TripHeaderProps> = ({
  tripName,
  destination,
  startDate,
  endDate,
  travelers,
  className = "",
  showLocalCurrency,
  localCurrency = "EUR",
  onCurrencyToggle,
  onShare,
  onOptimize,
  isOptimizing = false,
  canOptimize = true,
  showOptimizeLock = false,
}) => {
  const formatDateRange = (start: string, end: string) => {
    const startD = parseLocalDate(start);
    const endD = parseLocalDate(end);

    if (startD.getFullYear() === endD.getFullYear()) {
      return `${format(startD, "MMM d")} – ${format(endD, "MMM d, yyyy")}`;
    }

    return `${format(startD, "MMM d, yyyy")} – ${format(endD, "MMM d, yyyy")}`;
  };

  const hasActions = onCurrencyToggle || onShare || onOptimize;

  return (
    <div className={`bg-card border-b border-border ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left: Trip info */}
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">{tripName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-1.5" />
                {destination}
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1.5" />
                {formatDateRange(startDate, endDate)}
              </div>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1.5" />
                {travelers} {travelers === 1 ? "traveler" : "travelers"}
              </div>
            </div>
          </div>

          {/* Right: Quick actions */}
          {hasActions && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Currency Toggle */}
              {onCurrencyToggle && (
                <button
                  onClick={onCurrencyToggle}
                  data-tour="currency-toggle"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary/50 border border-border text-xs font-medium hover:bg-secondary transition-colors"
                  title={`Switch to ${showLocalCurrency ? 'USD' : localCurrency}`}
                >
                  <span className={showLocalCurrency ? 'text-primary' : 'text-muted-foreground'}>
                    {localCurrency}
                  </span>
                  <span className="text-muted-foreground/50">/</span>
                  <span className={!showLocalCurrency ? 'text-primary' : 'text-muted-foreground'}>
                    USD
                  </span>
                </button>
              )}

              {/* Share Button */}
              {onShare && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onShare}
                  data-tour="share-button"
                  className="gap-1.5 h-8 text-xs"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              )}

              {/* Optimize Button */}
              {onOptimize && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={onOptimize}
                      disabled={isOptimizing || !canOptimize} 
                      data-tour="optimize-button"
                      className="gap-1.5 h-8 text-xs"
                    >
                      {isOptimizing ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Route className="h-3.5 w-3.5" />
                      )}
                      {isOptimizing ? 'Optimizing...' : 'Optimize'}
                      {showOptimizeLock && <Lock className="h-3 w-3 ml-0.5 opacity-60" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reorders activities to minimize transit time (saves ~30 mins)</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripHeader;
