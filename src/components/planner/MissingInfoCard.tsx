import { AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MissingInfoCardProps {
  missingFlight?: boolean;
  missingHotel?: boolean;
  missingDates?: boolean;
  message?: string;
  redirectPath?: string;
  redirectLabel?: string;
  className?: string;
}

export default function MissingInfoCard({
  missingFlight,
  missingHotel,
  missingDates,
  message,
  redirectPath,
  redirectLabel,
  className
}: MissingInfoCardProps) {
  const navigate = useNavigate();

  const generateMessage = () => {
    if (message) return message;
    
    const missing = [];
    if (missingDates) missing.push('travel dates');
    if (missingFlight) missing.push('flight');
    if (missingHotel) missing.push('hotel');
    
    if (missing.length === 0) return 'Some information is missing';
    if (missing.length === 1) return `Please select a ${missing[0]} to continue`;
    
    const last = missing.pop();
    return `Please select ${missing.join(', ')} and ${last} to continue`;
  };

  const displayMessage = generateMessage();

  return (
    <div className={cn('p-4', className)}>
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-600" />
        </div>
        
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            {displayMessage}
          </p>
          
          {redirectPath && (
            <button
              className="mt-2 inline-flex items-center text-xs font-medium text-amber-700 hover:text-amber-600 transition-colors"
              onClick={() => navigate(redirectPath)}
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              {redirectLabel || 'Go back'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
