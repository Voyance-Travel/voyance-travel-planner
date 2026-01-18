/**
 * Flight Preferences Form
 * Uses the searchAirports function from existing airportSearch service
 */

import { AlertCircle } from 'lucide-react';
import React, { useState, useCallback } from 'react';
import { searchAirports, getAirportByCode } from '@/services/airportSearch';
import AutoCompleteSelect from '@/components/common/AutoCompleteSelect';

export interface UserFlightPreferences {
  homeAirport?: string | null;
  airportCode?: string | null;
  directFlightsOnly?: boolean | null;
  preferredCabinClass?: 'economy' | 'premium_economy' | 'business' | 'first' | null;
  seatPreference?: 'window' | 'aisle' | 'middle' | 'no_preference' | null;
  preferredAirlines?: string[] | null;
}

interface FlightPreferencesFormProps {
  preferences: Partial<UserFlightPreferences>;
  onChange: (preferences: Partial<UserFlightPreferences>) => void;
  disabled?: boolean;
}

export const FlightPreferencesForm: React.FC<FlightPreferencesFormProps> = ({
  preferences,
  onChange,
  disabled = false,
}) => {
  const [validationErrors] = useState<Record<string, string>>({});
  const [airportLabels, setAirportLabels] = useState<{
    homeAirport?: string;
    preferredAirport?: string;
  }>({});

  // Handle airport search
  const handleAirportSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) return [];

    try {
      const results = await searchAirports(query);
      return results.map(dest => ({
        value: dest.code,
        label: `${dest.name} (${dest.code}) - ${dest.city}, ${dest.country}`,
        data: {
          code: dest.code,
          displayName: `${dest.name} (${dest.code})`,
        },
      }));
    } catch (err) {
      console.error('Error searching airports:', err);
      return [];
    }
  }, []);

  // Get airport label from code
  const getAirportLabel = useCallback(async (code: string | undefined | null): Promise<string> => {
    if (!code) return '';

    try {
      const airport = await getAirportByCode(code);
      if (airport) {
        return `${airport.name} (${airport.code})`;
      }
    } catch (err) {
      console.error('Error looking up airport:', err);
    }

    return code;
  }, []);

  // Load airport labels on mount
  React.useEffect(() => {
    const loadLabels = async () => {
      if (preferences.homeAirport) {
        const label = await getAirportLabel(preferences.homeAirport);
        setAirportLabels(prev => ({ ...prev, homeAirport: label }));
      }
      if (preferences.airportCode) {
        const label = await getAirportLabel(preferences.airportCode);
        setAirportLabels(prev => ({ ...prev, preferredAirport: label }));
      }
    };
    loadLabels();
  }, [preferences.homeAirport, preferences.airportCode, getAirportLabel]);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Home Airport
        </label>
        <AutoCompleteSelect
          value={
            preferences.homeAirport
              ? {
                  value: preferences.homeAirport,
                  label: airportLabels.homeAirport || preferences.homeAirport,
                }
              : null
          }
          onChange={option => {
            if (option?.value) {
              onChange({ ...preferences, homeAirport: option.value });
              setAirportLabels(prev => ({ ...prev, homeAirport: option.label }));
            }
          }}
          onSearch={handleAirportSearch}
          placeholder="Search for your home airport..."
          className="w-full"
          disabled={disabled}
        />
        {validationErrors.homeAirport && (
          <p className="mt-1 text-sm text-destructive flex items-center">
            <AlertCircle className="w-4 h-4 mr-1" />
            {validationErrors.homeAirport}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Preferred Departure Airport
        </label>
        <AutoCompleteSelect
          value={
            preferences.airportCode
              ? {
                  value: preferences.airportCode,
                  label: airportLabels.preferredAirport || preferences.airportCode,
                }
              : null
          }
          onChange={option => {
            if (option?.value) {
              onChange({ ...preferences, airportCode: option.value });
              setAirportLabels(prev => ({ ...prev, preferredAirport: option.label }));
            }
          }}
          onSearch={handleAirportSearch}
          placeholder="Search for your preferred airport..."
          className="w-full"
          disabled={disabled}
        />
      </div>

      <div>
        <label htmlFor="cabin-class" className="block text-sm font-medium text-foreground mb-2">
          Preferred Cabin Class
        </label>
        <select
          id="cabin-class"
          value={preferences.preferredCabinClass || ''}
          onChange={e =>
            onChange({
              ...preferences,
              preferredCabinClass: e.target.value as UserFlightPreferences['preferredCabinClass'],
            })
          }
          disabled={disabled}
          className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="">Select a cabin class</option>
          <option value="economy">Economy</option>
          <option value="premium_economy">Premium Economy</option>
          <option value="business">Business</option>
          <option value="first">First</option>
        </select>
      </div>

      <div>
        <label htmlFor="seat-preference" className="block text-sm font-medium text-foreground mb-2">
          Seat Preference
        </label>
        <select
          id="seat-preference"
          value={preferences.seatPreference || ''}
          onChange={e =>
            onChange({
              ...preferences,
              seatPreference: e.target.value as UserFlightPreferences['seatPreference'],
            })
          }
          disabled={disabled}
          className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="">Select a seat preference</option>
          <option value="window">Window</option>
          <option value="aisle">Aisle</option>
          <option value="middle">Middle</option>
          <option value="no_preference">No Preference</option>
        </select>
      </div>

      <div className="flex items-center">
        <input
          id="direct-flights"
          type="checkbox"
          checked={preferences.directFlightsOnly || false}
          onChange={e => onChange({ ...preferences, directFlightsOnly: e.target.checked })}
          disabled={disabled}
          className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
        />
        <label htmlFor="direct-flights" className="ml-2 block text-sm text-foreground">
          Prefer direct flights only
        </label>
      </div>
    </div>
  );
};
