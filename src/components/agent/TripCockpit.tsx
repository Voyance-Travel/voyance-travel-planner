/**
 * Trip Cockpit - The Agent's Command Center
 * 
 * One screen shows everything at a glance:
 * - Itinerary status + share link
 * - Next 5 tasks/deadlines
 * - Confirmations summary (PNRs, hotel conf#, etc.)
 * - Money snapshot (A/R, A/P, Expected/Received Commission, Payout)
 */

import { useState } from 'react';
import { getAppUrl } from '@/utils/getAppUrl';
import {
  Calendar,
  Clock,
  CheckSquare,
  Plane,
  Hotel,
  Car,
  MapPin,
  Link2,
  Copy,
  AlertCircle,
  ArrowRight,
  Users,
  DollarSign,
  Banknote,
  Building2,
  TrendingUp,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, isPast, isFuture } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import type { 
  AgencyTrip, 
  BookingSegment, 
  AgencyTask, 
  PaymentSchedule 
} from '@/services/agencyCRM';

interface TripCockpitProps {
  trip: AgencyTrip;
  segments: BookingSegment[];
  tasks: AgencyTask[];
  paymentSchedules: PaymentSchedule[];
  onOpenShareModal: () => void;
  onOpenTab: (tab: string) => void;
  formatCurrency: (cents: number) => string;
}

const SEGMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: Hotel,
  car_rental: Car,
  transfer: Car,
  tour: MapPin,
  default: FileText,
};

export default function TripCockpit({
  trip,
  segments,
  tasks,
  paymentSchedules,
  onOpenShareModal,
  onOpenTab,
  formatCurrency,
}: TripCockpitProps) {
  const [linkCopied, setLinkCopied] = useState(false);

  // Calculations
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const urgentTasks = pendingTasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
  const confirmedSegments = segments.filter(s => s.status === 'confirmed' || s.status === 'ticketed');
  const pendingSegments = segments.filter(s => s.status === 'pending');
  
  // Financial calculations (matching travel subledger logic)
  const totalClientCharges = segments.reduce((sum, s) => sum + (s.sell_price_cents || 0), 0);
  const clientBalance = totalClientCharges - (trip.total_paid_cents || 0); // A/R
  
  const supplierDirectSegments = segments.filter(s => s.settlement_type === 'supplier_direct' || !s.settlement_type);
  const vendorBalance = supplierDirectSegments.reduce((sum, s) => 
    sum + (s.net_cost_cents || 0) - (s.supplier_paid_cents || 0), 0); // A/P
  
  const commissionExpected = segments.reduce((sum, s) => sum + (s.commission_expected_cents || s.commission_cents || 0), 0);
  const commissionReceived = segments.reduce((sum, s) => sum + (s.commission_received_cents || 0), 0);
  
  // Agent payout = Commission received - any unrecovered costs
  const agentPayout = commissionReceived;

  const upcomingSchedules = paymentSchedules
    .filter(s => !s.is_paid && s.due_date)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 3);

  const daysUntilTrip = trip.start_date 
    ? differenceInDays(parseLocalDate(trip.start_date), new Date())
    : null;

  const itineraryDaysCount = trip.itinerary_data?.days?.length || 0;

  const shareUrl = trip.share_token 
    ? `${getAppUrl()}/share/${trip.share_token}`
    : null;

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      toast({ title: 'Link copied!' });
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Row: Itinerary Status + Share | Money Snapshot */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Itinerary Status Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Itinerary Status
              </CardTitle>
              {daysUntilTrip !== null && daysUntilTrip > 0 && (
                <Badge variant={daysUntilTrip <= 14 ? 'destructive' : 'secondary'}>
                  {daysUntilTrip}d until departure
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Days Crafted</p>
                <p className="text-2xl font-bold">{itineraryDaysCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Bookings</p>
                <p className="text-2xl font-bold">
                  <span className="text-emerald-600">{confirmedSegments.length}</span>
                  <span className="text-muted-foreground text-lg">/{segments.length}</span>
                </p>
              </div>
            </div>

            {/* Share Link Section */}
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Client Share Link</p>
              {trip.share_enabled && shareUrl ? (
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono truncate">
                    {shareUrl}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCopyLink}>
                    {linkCopied ? <CheckSquare className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={onOpenShareModal}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Generate Share Link
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Money Snapshot - Subledger Style */}
        <Card className="lg:col-span-3 bg-gradient-to-br from-slate-50 to-background border-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Money Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* A/R */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Client Balance (A/R)
                </div>
                <p className={`text-xl font-bold ${clientBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {formatCurrency(clientBalance)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(trip.total_paid_cents || 0)} collected
                </p>
              </div>

              {/* A/P */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  Vendor Balance (A/P)
                </div>
                <p className={`text-xl font-bold ${vendorBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatCurrency(vendorBalance)}
                </p>
                <p className="text-xs text-muted-foreground">
                  owed to suppliers
                </p>
              </div>

              {/* Expected Commission */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Expected Commission
                </div>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(commissionExpected)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(commissionReceived)} received
                </p>
              </div>

              {/* Agent Payout */}
              <div className="space-y-1 bg-primary/5 rounded-lg p-3 -m-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5" />
                  Agent Payout
                </div>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(agentPayout)}
                </p>
                <p className="text-xs text-muted-foreground">
                  earned so far
                </p>
              </div>
            </div>

            {/* Payment Due Alert */}
            {upcomingSchedules.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">
                      Next payment: <span className="font-medium">{upcomingSchedules[0].description}</span>
                    </span>
                    <Badge variant="outline">
                      {format(new Date(upcomingSchedules[0].due_date), 'MMM d')}
                    </Badge>
                  </div>
                  <span className="font-bold">{formatCurrency(upcomingSchedules[0].amount_cents)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Tasks + Confirmations */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Next 5 Tasks/Deadlines */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Upcoming Deadlines
              </CardTitle>
              {urgentTasks.length > 0 && (
                <CardDescription className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {urgentTasks.length} urgent items
                </CardDescription>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => onOpenTab('tasks')}>
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTasks.slice(0, 5).map(task => {
                  const isOverdue = task.due_date && isPast(new Date(task.due_date));
                  return (
                    <div 
                      key={task.id} 
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        isOverdue ? 'bg-red-50 border border-red-200' : 'bg-muted/50'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.priority === 'urgent' ? 'bg-red-500' :
                        task.priority === 'high' ? 'bg-orange-500' : 
                        task.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        {task.due_date && (
                          <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {isOverdue ? 'Overdue: ' : 'Due: '}
                            {format(new Date(task.due_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <Badge 
                        variant="outline" 
                        className={
                          task.priority === 'urgent' ? 'bg-red-50 text-red-600 border-red-200' :
                          task.priority === 'high' ? 'bg-orange-50 text-orange-600 border-orange-200' : ''
                        }
                      >
                        {task.priority}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmations Summary */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Confirmations
              </CardTitle>
              <CardDescription>
                {confirmedSegments.length} of {segments.length} confirmed
              </CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onOpenTab('bookings')}>
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {segments.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Plane className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No bookings yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {segments.slice(0, 5).map(segment => {
                  const Icon = SEGMENT_ICONS[segment.segment_type] || SEGMENT_ICONS.default;
                  const isConfirmed = segment.status === 'confirmed' || segment.status === 'ticketed';
                  
                  return (
                    <div 
                      key={segment.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isConfirmed ? 'bg-emerald-100' : 'bg-amber-100'
                        }`}>
                          <Icon className={`h-4 w-4 ${isConfirmed ? 'text-emerald-600' : 'text-amber-600'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {segment.vendor_name || segment.segment_type}
                          </p>
                          {segment.confirmation_number ? (
                            <p className="text-xs font-mono text-muted-foreground">
                              {segment.confirmation_number}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600">Awaiting confirmation</p>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant="outline"
                        className={
                          isConfirmed 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                        }
                      >
                        {segment.status}
                      </Badge>
                    </div>
                  );
                })}
                
                {segments.length > 5 && (
                  <Button 
                    variant="ghost" 
                    className="w-full text-sm"
                    onClick={() => onOpenTab('bookings')}
                  >
                    +{segments.length - 5} more bookings
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alert Banner for Pending Items */}
      {(pendingSegments.length > 0 || clientBalance > 0) && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div className="flex-1 flex flex-wrap gap-4">
                {pendingSegments.length > 0 && (
                  <span className="text-sm">
                    <span className="font-medium text-amber-700">{pendingSegments.length}</span> bookings pending confirmation
                  </span>
                )}
                {clientBalance > 0 && (
                  <span className="text-sm">
                    <span className="font-medium text-amber-700">{formatCurrency(clientBalance)}</span> outstanding from client
                  </span>
                )}
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className="border-amber-300 hover:bg-amber-100"
                onClick={() => onOpenTab('finance')}
              >
                Review Finance
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
