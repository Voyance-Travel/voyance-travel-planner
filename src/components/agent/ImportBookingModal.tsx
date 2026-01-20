import { useState, useCallback, useRef } from 'react';
import { 
  FileText, 
  Loader2, 
  Check, 
  AlertCircle, 
  Wand2, 
  Upload, 
  Mail, 
  ClipboardPaste,
  File,
  X,
  DollarSign
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { createSegment, updateTrip, getTrip, type BookingSegmentType, type BookingSettlementType } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';
import type { EditorialDay } from '@/components/itinerary/EditorialItinerary';

interface ImportBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onSuccess: () => void;
}

interface ParsedBooking {
  segment_type: BookingSegmentType;
  vendor_name?: string;
  confirmation_number?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  origin?: string;
  origin_code?: string;
  destination?: string;
  destination_code?: string;
  flight_number?: string;
  cabin_class?: string;
  room_type?: string;
  room_count?: number;
  notes?: string;
  net_cost_cents?: number;
  sell_price_cents?: number;
  commission_cents?: number;
}

const SEGMENT_TYPE_LABELS: Record<string, string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  car_rental: 'Car Rental',
  rail: 'Rail',
  tour: 'Tour',
  cruise: 'Cruise',
  transfer: 'Transfer',
  insurance: 'Insurance',
  other: 'Other',
};

const SETTLEMENT_TYPE_INFO: Record<string, { label: string; description: string }> = {
  arc_bsp: { label: 'ARC/BSP', description: 'Airline reporting settlement' },
  supplier_direct: { label: 'Supplier Direct', description: 'You collect from client, pay supplier' },
  commission_track: { label: 'Commission Track', description: 'Client pays supplier, commission due to you' },
};

export default function ImportBookingModal({ open, onOpenChange, tripId, onSuccess }: ImportBookingModalProps) {
  const [importMethod, setImportMethod] = useState<'paste' | 'file' | 'email'>('paste');
  const [confirmationText, setConfirmationText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedBooking, setParsedBooking] = useState<ParsedBooking | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Finance ledger fields
  const [settlementType, setSettlementType] = useState<BookingSettlementType>('supplier_direct');
  const [sellPrice, setSellPrice] = useState('');
  const [commission, setCommission] = useState('');

  const handleParse = async (textToParse?: string) => {
    const text = textToParse || confirmationText;
    if (!text.trim()) {
      setError('Please paste a booking confirmation or upload a file');
      return;
    }

    setParsing(true);
    setError(null);
    setParsedBooking(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-booking-confirmation', {
        body: { confirmationText: text },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setParsedBooking(data.booking);
      
      // Pre-fill finance fields if available
      if (data.booking?.net_cost_cents) {
        setSellPrice((data.booking.net_cost_cents / 100).toFixed(2));
      }
    } catch (err) {
      console.error('Error parsing:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse booking confirmation');
    } finally {
      setParsing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setError(null);
    setParsing(true);

    try {
      // For PDFs, we need to extract text first
      if (file.type === 'application/pdf') {
        // Use document parsing edge function
        const formData = new FormData();
        formData.append('file', file);
        
        const { data, error: fnError } = await supabase.functions.invoke('parse-document-text', {
          body: formData,
        });

        if (fnError) {
          // Fallback: try reading as text if PDF parsing fails
          console.warn('PDF parsing not available, trying text extraction');
          const text = await file.text();
          if (text.trim()) {
            await handleParse(text);
            return;
          }
          throw new Error('Could not extract text from PDF. Try copy/paste instead.');
        }
        
        if (data?.text) {
          await handleParse(data.text);
        } else {
          throw new Error('No text extracted from document');
        }
      } else {
        // For text files, read directly
        const text = await file.text();
        if (text.trim()) {
          setConfirmationText(text);
          await handleParse(text);
        } else {
          throw new Error('File appears to be empty');
        }
      }
    } catch (err) {
      console.error('Error processing file:', err);
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setParsing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const validTypes = ['application/pdf', 'text/plain', 'text/html', 'message/rfc822'];
      if (validTypes.includes(file.type) || file.name.endsWith('.eml') || file.name.endsWith('.txt')) {
        handleFileUpload(file);
      } else {
        setError('Please upload a PDF, text file, or email (.eml)');
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleSave = async () => {
    if (!parsedBooking) return;

    setSaving(true);
    try {
      const netCostCents = parsedBooking.net_cost_cents || 0;
      const sellPriceCents = sellPrice ? Math.round(parseFloat(sellPrice) * 100) : netCostCents;
      const commissionCents = commission ? Math.round(parseFloat(commission) * 100) : 0;

      // Create the booking segment with 'imported' source
      const segment = await createSegment({
        trip_id: tripId,
        segment_type: parsedBooking.segment_type,
        status: 'pending',
        booking_source: 'imported', // Mode 2: External booking, imported
        vendor_name: parsedBooking.vendor_name,
        confirmation_number: parsedBooking.confirmation_number,
        start_date: parsedBooking.start_date,
        start_time: parsedBooking.start_time,
        end_date: parsedBooking.end_date,
        end_time: parsedBooking.end_time,
        origin: parsedBooking.origin,
        origin_code: parsedBooking.origin_code,
        destination: parsedBooking.destination,
        destination_code: parsedBooking.destination_code,
        flight_number: parsedBooking.flight_number,
        cabin_class: parsedBooking.cabin_class,
        room_type: parsedBooking.room_type,
        room_count: parsedBooking.room_count,
        net_cost_cents: netCostCents,
        sell_price_cents: sellPriceCents,
        commission_cents: commissionCents,
        commission_expected_cents: commissionCents,
        settlement_type: settlementType,
        notes: parsedBooking.notes,
      });

      // Auto-create itinerary item if we have a start date
      if (parsedBooking.start_date) {
        try {
          await addToItinerary(parsedBooking, segment.id);
        } catch (itinError) {
          console.warn('Could not auto-add to itinerary:', itinError);
          // Don't fail the whole import if itinerary update fails
        }
      }

      toast({ 
        title: 'Booking imported!',
        description: 'Added to bookings and itinerary'
      });
      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Error saving booking:', err);
      toast({ title: 'Failed to save booking', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Auto-add imported booking to itinerary
  const addToItinerary = async (booking: ParsedBooking, segmentId: string) => {
    const trip = await getTrip(tripId);
    if (!trip) return;

    const itineraryData = trip.itinerary_data || { days: [] };
    const days = (itineraryData.days || []) as EditorialDay[];
    
    // Find the day matching the booking's start date
    const bookingDate = booking.start_date;
    let targetDay = days.find(d => d.date === bookingDate);
    
    // If no matching day, create one or add to first day
    if (!targetDay && days.length > 0) {
      // Try to find closest day
      targetDay = days[0];
    }
    
    if (!targetDay) {
      // No itinerary yet - create first day
      targetDay = {
        dayNumber: 1,
        date: bookingDate,
        title: `Day 1`,
        activities: [],
      };
      days.push(targetDay);
    }

    // Map booking segment type to itinerary activity type
    type ItineraryActivityType = 'transportation' | 'accommodation' | 'dining' | 'cultural' | 'activity' | 'relaxation' | 'shopping';
    const mapSegmentToActivityType = (segmentType: BookingSegmentType): ItineraryActivityType => {
      const mapping: Record<string, ItineraryActivityType> = {
        flight: 'transportation',
        hotel: 'accommodation',
        car_rental: 'transportation',
        transfer: 'transportation',
        rail: 'transportation',
        tour: 'activity',
        cruise: 'transportation',
        insurance: 'activity',
        other: 'activity',
      };
      return mapping[segmentType] || 'activity';
    };

    // Create itinerary activity from booking
    const activityTitle = getActivityTitle(booking);
    const newActivity: EditorialDay['activities'][number] = {
      id: `imported-${segmentId}`,
      title: activityTitle,
      description: booking.notes || `Confirmation: ${booking.confirmation_number || 'Pending'}`,
      startTime: booking.start_time || '09:00',
      time: booking.start_time || '09:00',
      type: mapSegmentToActivityType(booking.segment_type),
      location: {
        name: booking.vendor_name || '',
        address: booking.destination || booking.origin || '',
      },
    };

    targetDay.activities.push(newActivity);

    // Save updated itinerary
    await updateTrip(tripId, {
      itinerary_data: { days } as unknown as typeof trip.itinerary_data,
    });
  };

  const getActivityTitle = (booking: ParsedBooking): string => {
    switch (booking.segment_type) {
      case 'flight':
        return `✈️ ${booking.flight_number || 'Flight'}: ${booking.origin_code || booking.origin || ''} → ${booking.destination_code || booking.destination || ''}`;
      case 'hotel':
        return `🏨 Check-in: ${booking.vendor_name || 'Hotel'}`;
      case 'car_rental':
        return `🚗 Pickup: ${booking.vendor_name || 'Car Rental'}`;
      case 'transfer':
        return `🚐 Transfer: ${booking.origin || ''} → ${booking.destination || ''}`;
      case 'tour':
        return `🎯 ${booking.vendor_name || 'Tour'}`;
      case 'cruise':
        return `🚢 Embark: ${booking.vendor_name || 'Cruise'}`;
      default:
        return `📋 ${booking.vendor_name || SEGMENT_TYPE_LABELS[booking.segment_type] || 'Booking'}`;
    }
  };

  const handleClose = () => {
    setConfirmationText('');
    setParsedBooking(null);
    setError(null);
    setUploadedFile(null);
    setSellPrice('');
    setCommission('');
    setSettlementType('supplier_direct');
    onOpenChange(false);
  };

  const formatDate = (date?: string) => {
    if (!date) return null;
    try {
      return new Date(date).toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return date;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Import Booking
          </DialogTitle>
          <DialogDescription>
            Import bookings from confirmations, PDFs, or emails. We'll extract details automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!parsedBooking ? (
            <>
              <Tabs value={importMethod} onValueChange={(v) => setImportMethod(v as typeof importMethod)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="paste" className="gap-2">
                    <ClipboardPaste className="h-4 w-4" />
                    Paste
                  </TabsTrigger>
                  <TabsTrigger value="file" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload
                  </TabsTrigger>
                  <TabsTrigger value="email" className="gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </TabsTrigger>
                </TabsList>

                {/* Paste Tab */}
                <TabsContent value="paste" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="confirmation">Paste Confirmation Text</Label>
                    <Textarea
                      id="confirmation"
                      value={confirmationText}
                      onChange={(e) => setConfirmationText(e.target.value)}
                      placeholder="Paste your booking confirmation email or text here...

Example:
Your flight is confirmed!
Confirmation: ABC123
United Airlines Flight UA 789
From: New York (JFK)
To: Los Angeles (LAX)
Date: March 15, 2026
Departure: 8:30 AM
Total: $450.00"
                      className="min-h-[180px] font-mono text-sm"
                    />
                  </div>
                  <Button 
                    onClick={() => handleParse()} 
                    disabled={parsing || !confirmationText.trim()} 
                    className="w-full"
                  >
                    {parsing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Parse Confirmation
                      </>
                    )}
                  </Button>
                </TabsContent>

                {/* File Upload Tab */}
                <TabsContent value="file" className="space-y-4 mt-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    {uploadedFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <File className="h-8 w-8 text-muted-foreground" />
                        <div className="text-left">
                          <p className="font-medium">{uploadedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(uploadedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setUploadedFile(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Drag & drop a PDF or confirmation file
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Supports PDF, TXT, HTML, and email files (.eml)
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.txt,.html,.eml,text/plain,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                        />
                        <Button 
                          variant="outline" 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={parsing}
                        >
                          {parsing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            'Choose File'
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </TabsContent>

                {/* Email Forwarding Tab */}
                <TabsContent value="email" className="space-y-4 mt-4">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-primary mt-0.5" />
                        <div className="space-y-2">
                          <p className="font-medium">Forward Confirmations by Email</p>
                          <p className="text-sm text-muted-foreground">
                            Forward booking confirmations to your import address:
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 bg-background rounded text-sm font-mono">
                              import@youragency.voyance.app
                            </code>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText('import@youragency.voyance.app');
                                toast({ title: 'Email copied!' });
                              }}
                            >
                              Copy
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Include the trip reference in the subject line (coming soon)
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <p className="text-sm text-muted-foreground text-center">
                    For now, use the <strong>Paste</strong> or <strong>Upload</strong> method to import bookings.
                  </p>
                </TabsContent>
              </Tabs>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 text-emerald-600 rounded-lg text-sm">
                <Check className="h-4 w-4" />
                Successfully extracted booking details
              </div>

              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-sm">
                      {SEGMENT_TYPE_LABELS[parsedBooking.segment_type] || parsedBooking.segment_type}
                    </Badge>
                    {parsedBooking.confirmation_number && (
                      <span className="font-mono text-sm">
                        #{parsedBooking.confirmation_number}
                      </span>
                    )}
                  </div>

                  {parsedBooking.vendor_name && (
                    <p className="font-semibold text-lg">{parsedBooking.vendor_name}</p>
                  )}

                  {parsedBooking.flight_number && (
                    <p className="font-mono">{parsedBooking.flight_number}</p>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {(parsedBooking.origin || parsedBooking.origin_code) && (
                      <div>
                        <p className="text-muted-foreground">From</p>
                        <p className="font-medium">
                          {parsedBooking.origin}
                          {parsedBooking.origin_code && ` (${parsedBooking.origin_code})`}
                        </p>
                      </div>
                    )}
                    {(parsedBooking.destination || parsedBooking.destination_code) && (
                      <div>
                        <p className="text-muted-foreground">To</p>
                        <p className="font-medium">
                          {parsedBooking.destination}
                          {parsedBooking.destination_code && ` (${parsedBooking.destination_code})`}
                        </p>
                      </div>
                    )}
                    {parsedBooking.start_date && (
                      <div>
                        <p className="text-muted-foreground">Start Date</p>
                        <p className="font-medium">
                          {formatDate(parsedBooking.start_date)}
                          {parsedBooking.start_time && ` at ${parsedBooking.start_time}`}
                        </p>
                      </div>
                    )}
                    {parsedBooking.end_date && (
                      <div>
                        <p className="text-muted-foreground">End Date</p>
                        <p className="font-medium">
                          {formatDate(parsedBooking.end_date)}
                          {parsedBooking.end_time && ` at ${parsedBooking.end_time}`}
                        </p>
                      </div>
                    )}
                  </div>

                  {parsedBooking.notes && (
                    <div>
                      <p className="text-muted-foreground text-sm">Notes</p>
                      <p className="text-sm">{parsedBooking.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Finance Ledger Integration */}
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Finance & Ledger</Label>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <Label>Submit To (Settlement Type)</Label>
                    <Select value={settlementType} onValueChange={(v) => setSettlementType(v as BookingSettlementType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SETTLEMENT_TYPE_INFO).map(([key, { label, description }]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex flex-col">
                              <span>{label}</span>
                              <span className="text-xs text-muted-foreground">{description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="netCost">Net Cost ($)</Label>
                      <Input
                        id="netCost"
                        type="number"
                        step="0.01"
                        value={parsedBooking.net_cost_cents ? (parsedBooking.net_cost_cents / 100).toFixed(2) : ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sellPrice">Sell Price ($)</Label>
                      <Input
                        id="sellPrice"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={sellPrice}
                        onChange={(e) => setSellPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="commission">Commission ($)</Label>
                      <Input
                        id="commission"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={commission}
                        onChange={(e) => setCommission(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Review the extracted details and set pricing. You can edit everything after saving.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {parsedBooking ? (
            <>
              <Button variant="outline" onClick={() => setParsedBooking(null)}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save to Trip
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
