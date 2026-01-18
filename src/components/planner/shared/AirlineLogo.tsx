import { useState } from 'react';
import { Plane } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AirlineLogoProps {
  code: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Airline code to name mapping for common airlines
const airlineNames: Record<string, string> = {
  'AA': 'American Airlines',
  'DL': 'Delta Air Lines',
  'UA': 'United Airlines',
  'WN': 'Southwest Airlines',
  'B6': 'JetBlue Airways',
  'AS': 'Alaska Airlines',
  'NK': 'Spirit Airlines',
  'F9': 'Frontier Airlines',
  'G4': 'Allegiant Air',
  'HA': 'Hawaiian Airlines',
  'BA': 'British Airways',
  'AF': 'Air France',
  'LH': 'Lufthansa',
  'KL': 'KLM',
  'LX': 'Swiss',
  'AZ': 'ITA Airways',
  'IB': 'Iberia',
  'EK': 'Emirates',
  'QR': 'Qatar Airways',
  'EY': 'Etihad Airways',
  'TK': 'Turkish Airlines',
  'SQ': 'Singapore Airlines',
  'CX': 'Cathay Pacific',
  'JL': 'Japan Airlines',
  'NH': 'ANA',
  'QF': 'Qantas',
  'AC': 'Air Canada',
  'AM': 'Aeromexico',
};

// Airline brand colors for fallback gradient
const airlineColors: Record<string, { from: string; to: string }> = {
  'AA': { from: '#0078d2', to: '#c60c30' },
  'DL': { from: '#003366', to: '#c8102e' },
  'UA': { from: '#002244', to: '#0066cc' },
  'WN': { from: '#304cb2', to: '#ffbf27' },
  'B6': { from: '#003876', to: '#1093d0' },
  'AS': { from: '#01426a', to: '#2774ae' },
  'NK': { from: '#ffc629', to: '#000000' },
  'F9': { from: '#1c4e1d', to: '#68a927' },
  'BA': { from: '#0d3880', to: '#eb2226' },
  'AF': { from: '#002157', to: '#e30613' },
  'LH': { from: '#05164d', to: '#f0ab00' },
  'EK': { from: '#d71921', to: '#c69320' },
  'QR': { from: '#5c0632', to: '#9c8c6e' },
  'SQ': { from: '#003366', to: '#c69f25' },
};

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export default function AirlineLogo({ 
  code, 
  name, 
  size = 'md',
  className 
}: AirlineLogoProps) {
  const [imageError, setImageError] = useState(false);
  const upperCode = code?.toUpperCase() || '';
  const airlineName = name || airlineNames[upperCode] || code;
  const colors = airlineColors[upperCode] || { from: '#6366f1', to: '#8b5cf6' };
  
  // Kiwi.com CDN for airline logos
  const logoUrl = `https://images.kiwi.com/airlines/64/${upperCode}.png`;

  if (imageError || !upperCode) {
    return (
      <div 
        className={cn(
          'rounded-lg flex items-center justify-center font-bold text-white',
          sizeClasses[size],
          className
        )}
        style={{ 
          background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`
        }}
        title={airlineName}
      >
        {upperCode ? (
          <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>
            {upperCode}
          </span>
        ) : (
          <Plane className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
        )}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1.5',
        sizeClasses[size],
        className
      )}
      title={airlineName}
    >
      <img
        src={logoUrl}
        alt={airlineName}
        className="w-full h-full object-contain"
        onError={() => setImageError(true)}
      />
    </div>
  );
}

// Export the airline name lookup function
export function getAirlineName(code: string): string {
  return airlineNames[code?.toUpperCase()] || code;
}
