/**
 * EditActivityModal — Edit an existing activity's details inline.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit3, Link2, CheckCircle2, AlertTriangle, Camera, X, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { validateCostUpdate } from '@/services/activityCostService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { VenueBank } from '@/hooks/useTripVenueBank';

interface EditableActivity {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  cost?: { amount: number; currency: string };
  location?: { name?: string; address?: string };
  image_url?: string;
  [key: string]: any;
}

interface EditActivityModalProps {
  isOpen: boolean;
  activity: EditableActivity | null;
  onClose: () => void;
  onSave: (updates: Partial<EditableActivity>) => void;
  currency?: string;
  venueBank?: VenueBank;
  tripId?: string;
}

/** Suggestion chips component for auto-fill */
function SuggestionChips({ 
  suggestions, 
  onSelect, 
  currentValue 
}: { 
  suggestions: string[]; 
  onSelect: (value: string) => void;
  currentValue: string;
}) {
  const filtered = suggestions.filter(s => 
    s.toLowerCase() !== currentValue.toLowerCase().trim() && 
    s.toLowerCase().includes(currentValue.toLowerCase().trim())
  ).slice(0, 4);

  if (filtered.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {filtered.map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors truncate max-w-[200px]"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function EditActivityModal({ isOpen, activity, onClose, onSave, currency = 'USD', venueBank, tripId }: EditActivityModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('activity');
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [cost, setCost] = useState('0');
  const [costError, setCostError] = useState<string | null>(null);
  const [costWarning, setCostWarning] = useState<string | null>(null);
  const [website, setWebsite] = useState('');
  const [reservationMade, setReservationMade] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // Track which fields are focused for showing suggestions
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (activity) {
      setTitle(activity.title || '');
      setDescription(activity.description || '');
      setCategory(activity.category || activity.type || 'activity');
      setStartTime(activity.startTime || activity.time || '12:00');
      setEndTime(activity.endTime || '13:00');
      setCost(String(activity.cost?.amount ?? activity.estimatedCost?.amount ?? 0));
      setWebsite(activity.website || activity.bookingUrl || '');
      setReservationMade(activity.reservationMade ?? false);
      setLocationName(activity.location?.name || '');
      setLocationAddress(activity.location?.address || '');
      setPhotoUrl(activity.image_url || null);
    }
  }, [activity]);

  // Validate cost on change
  const handleCostChange = (value: string) => {
    if (value === '' || parseFloat(value) >= 0) {
      setCost(value);
      const num = parseFloat(value) || 0;
      const validation = validateCostUpdate(category, num);
      setCostError(validation.valid ? null : validation.message || null);
      setCostWarning(validation.valid ? (validation.warning || null) : null);
    }
  };

  // Re-validate when category changes
  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    const num = parseFloat(cost) || 0;
    if (num > 0) {
      const validation = validateCostUpdate(newCategory, num);
      setCostError(validation.valid ? null : validation.message || null);
      setCostWarning(validation.valid ? (validation.warning || null) : null);
    } else {
      setCostWarning(null);
    }
  };

  // Venue bank: when a venue name is selected, auto-fill address and website
  const handleVenueSelect = useCallback((name: string) => {
    setLocationName(name);
    if (venueBank) {
      const venue = venueBank.getVenue(name);
      if (venue?.address && !locationAddress) setLocationAddress(venue.address);
      if (venue?.website && !website) setWebsite(venue.website);
    }
  }, [venueBank, locationAddress, website]);

  // Photo upload
  const handlePhotoUpload = async (file: File) => {
    if (!user?.id || !tripId) {
      toast.error('Unable to upload photo');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be under 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const storagePath = `${user.id}/${tripId}/activity_${activity?.id || 'new'}_${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('trip-photos')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from('trip-photos')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

      if (urlData?.signedUrl) {
        setPhotoUrl(urlData.signedUrl);
        toast.success('Photo uploaded!');
      }
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error('Please enter an activity title');
      return;
    }
    const costNum = parseFloat(cost) || 0;
    const validation = validateCostUpdate(category, costNum);
    if (!validation.valid) {
      toast.error(validation.message || 'Invalid cost');
      return;
    }
    onSave({
      title: title.trim(),
      description,
      category,
      startTime,
      endTime,
      cost: { amount: costNum, currency },
      website: website.trim() || undefined,
      reservationMade,
      location: {
        name: locationName,
        address: locationAddress,
      },
      ...(photoUrl ? { image_url: photoUrl, photos: [photoUrl] } : {}),
    });
  };

  // Build suggestion lists from venue bank
  const venueNames = venueBank?.venues.map(v => v.name) || [];
  const addressList = venueBank?.addresses || [];
  const websiteList = venueBank?.websites || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            Edit Activity
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
          {/* Photo */}
          <div>
            <label className="text-sm font-medium mb-1 block">Photo</label>
            <div className="flex items-center gap-3">
              <div 
                className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted/30 border border-border shrink-0 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoUrl ? (
                  <>
                    <img src={photoUrl} alt="Activity" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {photoUrl ? 'Change Photo' : 'Upload Photo'}
                </Button>
                {photoUrl && (
                  <button 
                    type="button"
                    onClick={() => setPhotoUrl(null)} 
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                )}
                <p className="text-xs text-muted-foreground">JPEG, PNG, WebP · Max 5MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Activity name" />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sightseeing">Sightseeing</SelectItem>
                <SelectItem value="dining">Dining</SelectItem>
                <SelectItem value="cultural">Cultural</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
                <SelectItem value="relaxation">Relaxation</SelectItem>
                <SelectItem value="shopping">Shopping</SelectItem>
                <SelectItem value="nightlife">Nightlife</SelectItem>
                <SelectItem value="transportation">Transportation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Start Time</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">End Time</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Venue Name</label>
              <Input 
                value={locationName} 
                onChange={(e) => setLocationName(e.target.value)} 
                placeholder="e.g. Louvre Museum" 
                onFocus={() => setFocusedField('venue')}
                onBlur={() => setTimeout(() => setFocusedField(null), 150)}
              />
              {focusedField === 'venue' && venueNames.length > 0 && (
                <SuggestionChips 
                  suggestions={venueNames} 
                  onSelect={handleVenueSelect}
                  currentValue={locationName}
                />
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Address</label>
              <Input 
                value={locationAddress} 
                onChange={(e) => setLocationAddress(e.target.value)} 
                placeholder="e.g. Rue de Rivoli, Paris" 
                onFocus={() => setFocusedField('address')}
                onBlur={() => setTimeout(() => setFocusedField(null), 150)}
              />
              {focusedField === 'address' && addressList.length > 0 && (
                <SuggestionChips 
                  suggestions={addressList} 
                  onSelect={setLocationAddress}
                  currentValue={locationAddress}
                />
              )}
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="text-sm font-medium mb-1 block">Cost ({currency})</label>
            <Input type="number" min="0" value={cost} onChange={(e) => handleCostChange(e.target.value)} placeholder="0" className={costError ? 'border-destructive' : costWarning ? 'border-yellow-500' : ''} />
            {costError && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>{costError}</span>
              </div>
            )}
            {costWarning && !costError && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>{costWarning}</span>
              </div>
            )}
          </div>

          {/* Website / Link */}
          <div>
            <label className="text-sm font-medium mb-1 block">Website / Link</label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={website} 
                onChange={(e) => setWebsite(e.target.value)} 
                placeholder="https://..." 
                className="pl-9" 
                onFocus={() => setFocusedField('website')}
                onBlur={() => setTimeout(() => setFocusedField(null), 150)}
              />
            </div>
            {focusedField === 'website' && websiteList.length > 0 && (
              <SuggestionChips 
                suggestions={websiteList} 
                onSelect={setWebsite}
                currentValue={website}
              />
            )}
          </div>

          {/* Reservation confirmation */}
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
            <Checkbox 
              id="reservation-made" 
              checked={reservationMade} 
              onCheckedChange={(checked) => setReservationMade(checked === true)} 
            />
            <label htmlFor="reservation-made" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Reservation / Tickets Confirmed
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title || !!costError}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditActivityModal;
