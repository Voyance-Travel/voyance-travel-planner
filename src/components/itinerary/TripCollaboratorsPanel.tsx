/**
 * Trip Collaborators Panel
 * 
 * Shows trip owner and collaborators with permission management
 * Owner can grant/revoke edit access to guests
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, Users, Eye, Edit3, UserPlus, MoreVertical, 
  Check, X, Shield, ChevronDown 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  useTripCollaborators, 
  useTripPermission,
  useUpdateCollaboratorPermission,
  useRemoveTripCollaborator,
  type TripCollaborator,
  type CollaboratorPermission,
} from '@/services/tripCollaboratorsAPI';
import { toast } from 'sonner';

interface TripCollaboratorsPanelProps {
  tripId: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerAvatarUrl?: string;
  onInviteClick?: () => void;
  compact?: boolean;
}

const permissionLabels: Record<CollaboratorPermission, { label: string; icon: typeof Eye; description: string }> = {
  viewer: { 
    label: 'Viewer', 
    icon: Eye, 
    description: 'Can view the itinerary only' 
  },
  editor: { 
    label: 'Editor', 
    icon: Edit3, 
    description: 'Can edit activities and make changes' 
  },
  contributor: { 
    label: 'Contributor', 
    icon: Edit3, 
    description: 'Can suggest and add activities' 
  },
};

export function TripCollaboratorsPanel({
  tripId,
  ownerName,
  ownerEmail,
  ownerAvatarUrl,
  onInviteClick,
  compact = false,
}: TripCollaboratorsPanelProps) {
  const { data: collaborators = [], isLoading } = useTripCollaborators(tripId);
  const { data: permission } = useTripPermission(tripId);
  const updatePermission = useUpdateCollaboratorPermission();
  const removeCollaborator = useRemoveTripCollaborator();
  const [expanded, setExpanded] = useState(!compact);

  const isOwner = permission?.isOwner ?? false;

  const handlePermissionChange = async (collaborator: TripCollaborator, newPermission: CollaboratorPermission) => {
    updatePermission.mutate({ 
      collaboratorId: collaborator.id, 
      permission: newPermission 
    });
  };

  const handleRemove = async (collaborator: TripCollaborator) => {
    if (confirm(`Remove ${collaborator.profile?.display_name || 'this collaborator'} from the trip?`)) {
      removeCollaborator.mutate(collaborator.id);
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.charAt(0).toUpperCase() || '?';
  };

  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
      >
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{1 + collaborators.length} travelers</span>
        <div className="flex -space-x-2">
          <Avatar className="h-6 w-6 border-2 border-background">
            {ownerAvatarUrl ? (
              <AvatarImage src={ownerAvatarUrl} />
            ) : null}
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {getInitials(ownerName, ownerEmail)}
            </AvatarFallback>
          </Avatar>
          {collaborators.slice(0, 3).map(c => (
            <Avatar key={c.id} className="h-6 w-6 border-2 border-background">
              {c.profile?.avatar_url ? (
                <AvatarImage src={c.profile.avatar_url} />
              ) : null}
              <AvatarFallback className="text-xs bg-muted">
                {getInitials(c.profile?.display_name, c.profile?.handle)}
              </AvatarFallback>
            </Avatar>
          ))}
          {collaborators.length > 3 && (
            <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
              +{collaborators.length - 3}
            </div>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
      </button>
    );
  }

  return (
    <Card className={cn(compact && "border-0 shadow-none bg-transparent")}>
      {!compact && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Trip Members
            </CardTitle>
            {compact && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(false)} aria-label="Close panel">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
      )}
      
      <CardContent className={cn(compact && "p-0")}>
        <div className="space-y-3">
          {/* Owner */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                {ownerAvatarUrl ? (
                  <AvatarImage src={ownerAvatarUrl} />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(ownerName, ownerEmail)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{ownerName || ownerEmail?.split('@')[0] || 'Trip Owner'}</span>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Crown className="h-3 w-3" />
                    Owner
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Full control over the trip
                </p>
              </div>
            </div>
          </div>

          {/* Collaborators */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <AnimatePresence>
              {collaborators.map(collaborator => {
                const permInfo = permissionLabels[collaborator.permission] || permissionLabels.viewer;
                const PermIcon = permInfo.icon;
                
                return (
                  <motion.div
                    key={collaborator.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-between py-2 border-t border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {collaborator.profile?.avatar_url ? (
                          <AvatarImage src={collaborator.profile.avatar_url} />
                        ) : null}
                        <AvatarFallback className="bg-muted">
                          {getInitials(collaborator.profile?.display_name, collaborator.profile?.handle)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium text-sm">
                          {collaborator.profile?.display_name || collaborator.profile?.handle || 'Guest'}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <PermIcon className="h-3 w-3" />
                          <span>{permInfo.label}</span>
                        </div>
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={collaborator.permission}
                          onValueChange={(value: CollaboratorPermission) => handlePermissionChange(collaborator, value)}
                        >
                          <SelectTrigger className="h-8 w-[110px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">
                              <div className="flex items-center gap-2">
                                <Eye className="h-3 w-3" />
                                Viewer
                              </div>
                            </SelectItem>
                            <SelectItem value="editor">
                              <div className="flex items-center gap-2">
                                <Edit3 className="h-3 w-3" />
                                Editor
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Member options">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleRemove(collaborator)}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remove from trip
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {/* Invite Button */}
          {isOwner && onInviteClick && (
            <Button 
              variant="outline" 
              className="w-full mt-2"
              onClick={onInviteClick}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Guest
            </Button>
          )}

          {/* Current user permission indicator (for non-owners) */}
          {!isOwner && permission?.permission && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span>
                  You have <strong>{permission.permission}</strong> access
                  {permission.canEdit ? ' - you can edit this itinerary' : ' - view only'}
                </span>
              </div>
            </div>
          )}
        </div>

        {compact && expanded && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-3 text-xs"
            onClick={() => setExpanded(false)}
          >
            Collapse
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
