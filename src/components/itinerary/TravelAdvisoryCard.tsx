/**
 * TravelAdvisoryCard Component
 * 
 * Displays real-time travel advisory information including:
 * - Visa requirements
 * - Entry requirements
 * - Safety advisories
 * - Health requirements
 */

import { useState, useEffect } from 'react';
import { 
  Shield, AlertTriangle, FileCheck, Heart, 
  Loader2, Sparkles, ChevronDown, ChevronUp,
  BookOpen, CreditCard, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { lookupTravelAdvisory, TravelAdvisory } from '@/services/enrichmentService';
import { cn } from '@/lib/utils';

interface TravelAdvisoryCardProps {
  destination: string;
  originCountry?: string;
  travelDate?: string;
  className?: string;
}

const safetyColors: Record<string, { bg: string; text: string; icon: string }> = {
  'low-risk': { bg: 'bg-green-500/10', text: 'text-green-700 dark:text-green-300', icon: '✓' },
  'moderate': { bg: 'bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-300', icon: '!' },
  'elevated': { bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-300', icon: '!!' },
  'high-risk': { bg: 'bg-red-500/10', text: 'text-red-700 dark:text-red-300', icon: '⚠' },
};

export function TravelAdvisoryCard({ 
  destination, 
  originCountry,
  travelDate,
  className 
}: TravelAdvisoryCardProps) {
  const [advisory, setAdvisory] = useState<TravelAdvisory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    async function fetchAdvisory() {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await lookupTravelAdvisory(destination, originCountry, travelDate);
        
        if (!cancelled) {
          if (result.success) {
            setAdvisory(result.data);
          } else {
            setError(result.error || 'Failed to load advisory');
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching travel advisory:', err);
        if (!cancelled) {
          setError('Failed to load advisory');
          setIsLoading(false);
        }
      }
    }
    
    fetchAdvisory();
    
    return () => {
      cancelled = true;
    };
  }, [destination, originCountry, travelDate]);

  if (isLoading) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading travel requirements...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !advisory) {
    return null;
  }

  const safetyStyle = safetyColors[advisory.safetyLevel] || safetyColors['moderate'];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Need to Know
          <Badge variant="secondary" className="ml-auto text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Live data
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Safety Level */}
        <div className={cn("flex items-center gap-2 p-3 rounded-lg", safetyStyle.bg)}>
          <Shield className={cn("h-4 w-4", safetyStyle.text)} />
          <span className={cn("text-sm font-medium capitalize", safetyStyle.text)}>
            {advisory.safetyLevel.replace('-', ' ')} destination
          </span>
        </div>

        {/* Visa Requirements */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Visa Requirements</span>
          </div>
          <div className="pl-6 text-sm text-muted-foreground">
            {advisory.visaRequired ? (
              <div>
                <Badge variant="outline" className="text-xs mb-1">Visa Required</Badge>
                {advisory.visaType && <p>{advisory.visaType}</p>}
                {advisory.visaDetails && <p className="text-xs mt-1">{advisory.visaDetails}</p>}
              </div>
            ) : (
              <Badge variant="outline" className="text-xs text-green-600 border-green-600/30">
                Visa-free entry
              </Badge>
            )}
          </div>
        </div>

        {/* Entry Requirements */}
        {advisory.entryRequirements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Entry Requirements</span>
            </div>
            <ul className="pl-6 space-y-1">
              {advisory.entryRequirements.map((req, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Passport Validity */}
        {advisory.passportValidity && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pl-6">
            <Info className="h-3 w-3" />
            Passport: {advisory.passportValidity}
          </div>
        )}

        {/* Collapsible section for more details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full text-xs">
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  More details
                </>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            {/* Health Requirements */}
            {advisory.healthRequirements.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Health</span>
                </div>
                <ul className="pl-6 space-y-1">
                  {advisory.healthRequirements.map((req, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Currency Tips */}
            {advisory.currencyTips && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4 mt-0.5" />
                <span>{advisory.currencyTips}</span>
              </div>
            )}

            {/* Safety Advisory */}
            {advisory.safetyAdvisory && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">
                  {advisory.safetyAdvisory}
                </span>
              </div>
            )}

            {/* Important Notes */}
            {advisory.importantNotes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Current Alerts</span>
                </div>
                <ul className="pl-6 space-y-1">
                  {advisory.importantNotes.map((note, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-orange-500">!</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Last Updated */}
            <p className="text-xs text-muted-foreground text-right">
              Updated: {advisory.lastUpdated}
            </p>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
