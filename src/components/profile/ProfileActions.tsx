import { useState } from 'react';
import { RefreshCw, Settings, LogOut, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ProfileActionsProps {
  onRetakeQuiz?: () => void;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
  className?: string;
}

export default function ProfileActions({ 
  onRetakeQuiz,
  onLogout,
  onDeleteAccount,
  className = '' 
}: ProfileActionsProps) {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className={`space-y-3 ${className}`}>
      {onRetakeQuiz && (
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onRetakeQuiz}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retake Travel Quiz
        </Button>
      )}
      
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={() => navigate('/settings')}
      >
        <Settings className="w-4 h-4 mr-2" />
        Account Settings
      </Button>

      {onLogout && (
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      )}

      {onDeleteAccount && (
        <>
          {!showDeleteConfirm ? (
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          ) : (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-3">
              <p className="text-sm text-destructive">
                Are you sure? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={onDeleteAccount}
                >
                  Yes, Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
