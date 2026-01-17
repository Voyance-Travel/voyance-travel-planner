import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DayRegenerateButtonProps {
  dayNumber: number;
  onClick: () => void;
  isLoading?: boolean;
}

export const DayRegenerateButton: React.FC<DayRegenerateButtonProps> = ({
  dayNumber,
  onClick,
  isLoading = false
}) => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isLoading}
      className="text-xs"
    >
      <RefreshCw className={`mr-1.5 h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
      {isLoading ? "Updating..." : `Regenerate Day ${dayNumber}`}
    </Button>
  );
};

export default DayRegenerateButton;
