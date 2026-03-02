/**
 * Accept Trip Invite Page
 * Handles trip invite link acceptance with auth flow
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, CheckCircle2, AlertCircle, Loader2, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { saveReturnPath } from '@/utils/authReturnPath';
import { savePendingInviteToken, peekPendingInviteToken } from '@/utils/inviteTokenPersistence';
import logger from '@/lib/logger';
import MainLayout from '@/components/layout/MainLayout';

interface InviteInfo {
  valid: boolean;
  reason?: string;
  error?: string;
  tripName?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  inviterName?: string;
  inviterAvatar?: string;
  spotsRemaining?: number;
}

interface AcceptResult {
  success: boolean;
  reason?: string;
  error?: string;
  requiresAuth?: boolean;
  tripId?: string;
  alreadyMember?: boolean;
}

/** Map backend reason codes to user-friendly error messages */
function getErrorDisplay(reason?: string, fallbackError?: string) {
  switch (reason) {
    case 'token_not_found':
    case 'invalid_token':
      return {
        title: 'Link Not Valid',
        message: 'This invite link was not found. It may have been reset by the trip owner. Ask them for a new link.',
      };
    case 'expired':
      return {
        title: 'Link Expired',
        message: 'This invite link has expired. Ask the trip owner for a fresh link.',
      };
    case 'trip_full':
      return {
        title: 'Trip Is Full',
        message: 'This trip has reached its maximum number of travelers. Ask the owner to increase the traveler count.',
      };
    case 'invite_limit_reached':
      return {
        title: 'Link Limit Reached',
        message: 'This invite link has been used the maximum number of times. Ask the trip owner for a new link.',
      };
    case 'already_member':
      return {
        title: 'Already a Member',
        message: 'You are already a member of this trip. Check your dashboard.',
      };
    case 'already_owner':
      return {
        title: 'You Own This Trip',
        message: 'You are the owner of this trip — no need to join!',
      };
    case 'trip_not_found':
      return {
        title: 'Trip Not Found',
        message: 'The trip associated with this invite no longer exists.',
      };
    default:
      return {
        title: 'Invite Not Valid',
        message: fallbackError || 'This invite link is no longer valid.',
      };
  }
}

export default function AcceptInvite() {
  const { token: routeToken } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve token with fallback: route param → query param → persisted token
  const queryToken = searchParams.get('inviteToken');
  const token = routeToken || queryToken || peekPendingInviteToken();

  // Persist token immediately on mount for durability
  useEffect(() => {
    if (token) {
      savePendingInviteToken(token);
    }
  }, [token]);

  // If we have a persisted token but no route param, normalize URL
  useEffect(() => {
    if (!routeToken && token) {
      navigate(`/invite/${token}`, { replace: true });
    }
  }, [routeToken, token, navigate]);

  // Fetch invite info
  useEffect(() => {
    if (!token) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    const fetchInviteInfo = async () => {
      try {
        logger.info('[invite] Opening invite link', { token: token?.slice(0, 8) });
        const { data, error: fetchError } = await supabase.rpc('get_trip_invite_info', {
          p_token: token,
        });

        if (fetchError) throw fetchError;

        if (data) {
          const info = data as unknown as InviteInfo;
          setInviteInfo(info);
          if (!info.valid) {
            logger.warn('[invite] Invalid invite', { reason: info.reason, token: token?.slice(0, 8) });
            setError(info.error || 'Invalid invite');
          } else {
            logger.info('[invite] Valid invite displayed', { trip: info.tripName });
          }
        }
      } catch (err) {
        logger.error('[invite] Error fetching invite:', err);
        setError('Unable to load invite details');
      } finally {
        setLoading(false);
      }
    };

    fetchInviteInfo();
  }, [token]);

  const inviteReturnPath = token ? `/invite/${token}` : null;

  const redirectToInviteAuth = (mode: 'signin' | 'signup') => {
    if (!inviteReturnPath || !token) return;
    saveReturnPath(inviteReturnPath);
    savePendingInviteToken(token);
    navigate(`/${mode}?redirect=${encodeURIComponent(inviteReturnPath)}&inviteToken=${encodeURIComponent(token)}`);
  };

  const handleAccept = async () => {
    if (!token) return;

    setAccepting(true);
    logger.info('[invite] Accept attempt', { token: token?.slice(0, 8), userId: user?.id?.slice(0, 8) });

    try {
      const { data, error: acceptError } = await supabase.rpc('accept_trip_invite', {
        p_token: token,
      });

      if (acceptError) throw acceptError;

      const result = data as unknown as AcceptResult;

      if (result?.success) {
        logger.info('[invite] Accept succeeded', { tripId: result.tripId, alreadyMember: result.alreadyMember });
        setAccepted(true);
        toast.success(result.alreadyMember ? 'You\'re already a member!' : 'You\'ve joined the trip!');
        
        setTimeout(() => {
          navigate(`/trip/${result.tripId}`);
        }, 1500);
      } else if (result?.requiresAuth) {
        logger.info('[invite] Accept requires auth, redirecting');
        redirectToInviteAuth('signin');
      } else {
        logger.warn('[invite] Accept failed', { reason: result?.reason });
        const errorDisplay = getErrorDisplay(result?.reason, result?.error);
        setError(errorDisplay.message);
      }
    } catch (err) {
      logger.error('[invite] Accept error:', err);
      setError('Failed to accept invite. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleSignIn = () => {
    redirectToInviteAuth('signin');
  };

  const handleSignUp = () => {
    redirectToInviteAuth('signup');
  };

  if (loading || authLoading) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error || !inviteInfo?.valid) {
    const errorDisplay = getErrorDisplay(
      inviteInfo?.reason,
      error || inviteInfo?.error
    );
    
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-xl font-semibold mb-2">{errorDisplay.title}</h1>
              <p className="text-muted-foreground mb-4">
                {errorDisplay.message}
              </p>
              {inviteInfo?.reason && (
                <p className="text-xs text-muted-foreground/60 mb-4 font-mono">
                  Reason: {inviteInfo.reason}
                </p>
              )}
              <Button onClick={() => navigate('/')}>
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (accepted) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-sm"
          >
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">You're In!</h1>
            <p className="text-muted-foreground mb-4">
              Welcome to {inviteInfo.tripName}
            </p>

            <div className="bg-muted/50 rounded-lg p-3 mb-4 flex items-center gap-3">
              <UserPlus className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground text-left">
                <strong className="text-foreground">{inviteInfo.inviterName || 'The trip owner'}</strong> has been added as a friend. You'll find this trip in your dashboard.
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Redirecting to your trip...
            </p>
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full"
        >
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                {inviteInfo.inviterAvatar ? (
                  <Avatar className="h-10 w-10 border-2 border-background">
                    <AvatarImage src={inviteInfo.inviterAvatar} />
                    <AvatarFallback>{inviteInfo.inviterName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                {inviteInfo.inviterName || 'Someone'} invited you to join
              </p>
              <h1 className="text-2xl font-serif font-semibold">
                {inviteInfo.tripName}
              </h1>
            </div>

            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{inviteInfo.destination}</span>
                </div>
                {inviteInfo.startDate && inviteInfo.endDate && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>
                      {format(parseLocalDate(inviteInfo.startDate), 'MMM d')} - {format(parseLocalDate(inviteInfo.endDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {inviteInfo.spotsRemaining !== undefined && (
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{inviteInfo.spotsRemaining} spot{inviteInfo.spotsRemaining !== 1 ? 's' : ''} remaining</span>
                  </div>
                )}
              </div>

              {user ? (
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleAccept}
                  disabled={accepting}
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join This Trip'
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">
                    Sign in or create an account to join this trip
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" onClick={() => redirectToInviteAuth('signin')}>
                      Sign In
                    </Button>
                    <Button onClick={() => redirectToInviteAuth('signup')}>
                      Create Account
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground">
                By joining, you'll be added as a friend, and this trip will appear in your dashboard for easy access.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </MainLayout>
  );
}
