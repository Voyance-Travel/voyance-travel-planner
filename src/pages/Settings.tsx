import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Bell, Shield, Link2,
  ChevronRight, Mail, Smartphone, 
  LogOut, Trash2, Loader2, KeyRound,
  Briefcase, Users, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Notification preferences (loaded from DB)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [tripReminders, setTripReminders] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  
  // Travel Agent Mode
  const [travelAgentMode, setTravelAgentMode] = useState(false);
  const [agentBusinessName, setAgentBusinessName] = useState('');
  
  // Phone number
  const [phoneNumber, setPhoneNumber] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [tempPhone, setTempPhone] = useState('');
  
  // Password change dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Linked accounts (only Google now - removed Apple)
  const linkedAccounts = [
    { provider: 'google', email: user?.email, connected: !!user?.email },
  ];

  // Load preferences from database
  useEffect(() => {
    async function loadPreferences() {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('email_notifications, push_notifications, marketing_emails, trip_reminders, price_alerts, budget_alerts, phone_number, travel_agent_mode, agent_business_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('Error loading preferences:', error);
        } else if (data) {
          setEmailNotifications(data.email_notifications ?? true);
          setPushNotifications(data.push_notifications ?? false);
          setMarketingEmails(data.marketing_emails ?? false);
          setTripReminders(data.trip_reminders ?? true);
          setPriceAlerts(data.price_alerts ?? true);
          setBudgetAlerts(data.budget_alerts ?? true);
          setPhoneNumber(data.phone_number ?? '');
          setTravelAgentMode(data.travel_agent_mode ?? false);
          setAgentBusinessName(data.agent_business_name ?? '');
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadPreferences();
  }, [user?.id]);

  // Save preference to database
  const savePreference = async (field: string, value: boolean | string) => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ 
          user_id: user.id, 
          [field]: value 
        }, { onConflict: 'user_id' });
      
      if (error) {
        toast.error('Failed to save preference');
        console.error('Save error:', error);
      } else {
        toast.success('Preference saved');
      }
    } catch (err) {
      toast.error('Failed to save preference');
    } finally {
      setSaving(false);
    }
  };

  // Handle notification toggle changes
  const handleEmailNotifications = (checked: boolean) => {
    setEmailNotifications(checked);
    savePreference('email_notifications', checked);
  };
  
  const handlePushNotifications = (checked: boolean) => {
    setPushNotifications(checked);
    savePreference('push_notifications', checked);
  };
  
  const handleMarketingEmails = (checked: boolean) => {
    setMarketingEmails(checked);
    savePreference('marketing_emails', checked);
  };
  
  const handleTripReminders = (checked: boolean) => {
    setTripReminders(checked);
    savePreference('trip_reminders', checked);
  };
  
  const handlePriceAlerts = (checked: boolean) => {
    setPriceAlerts(checked);
    savePreference('price_alerts', checked);
  };

  // Save phone number
  const handleSavePhone = async () => {
    if (!user?.id) return;
    
    await savePreference('phone_number', tempPhone);
    setPhoneNumber(tempPhone);
    setEditingPhone(false);
  };

  const handleLogout = () => {
    logout();
    navigate(ROUTES.HOME);
    toast.success('You have been signed out');
  };

  // Password change handler
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully');
        setShowPasswordDialog(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      toast.error('Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Account deletion handler - calls edge function to fully delete auth user
  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    
    setDeletingAccount(true);
    try {
      // Call the self-service deletion edge function
      // This deletes the auth user, which cascades to all related data
      const { error } = await supabase.functions.invoke('delete-my-account');
      
      if (error) {
        console.error('Delete account error:', error);
        toast.error(error.message || 'Failed to delete account. Please contact support.');
        return;
      }
      
      // Sign out locally (session is already invalidated server-side)
      await supabase.auth.signOut();
      
      toast.success('Your account has been permanently deleted');
      navigate(ROUTES.HOME);
    } catch (err) {
      console.error('Delete account error:', err);
      toast.error('Failed to delete account. Please contact support.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head
        title="Settings | Voyance"
        description="Manage your account settings, notifications, and preferences."
      />
      
      <div className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
              Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your account preferences and notifications
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Account Section */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Account</CardTitle>
                      <CardDescription>Manage your account details</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <button 
                    onClick={() => navigate(ROUTES.PROFILE.EDIT)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Email</div>
                        <div className="text-sm text-muted-foreground">{user?.email || 'Not set'}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                  
                  <div className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-muted-foreground" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Phone</div>
                        {editingPhone ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="tel"
                              placeholder="+1 (555) 123-4567"
                              value={tempPhone}
                              onChange={(e) => setTempPhone(e.target.value)}
                              className="h-8 text-sm w-40"
                            />
                            <Button size="sm" onClick={handleSavePhone} disabled={saving}>
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingPhone(false)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {phoneNumber || 'Not set'}
                          </div>
                        )}
                      </div>
                    </div>
                    {!editingPhone && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setTempPhone(phoneNumber);
                          setEditingPhone(true);
                        }}
                      >
                        {phoneNumber ? 'Edit' : 'Add'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Notifications Section */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <Bell className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Notifications</CardTitle>
                      <CardDescription>Choose what updates you receive</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications" className="text-sm font-medium">
                        Email notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive booking confirmations and updates via email
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={emailNotifications}
                      onCheckedChange={handleEmailNotifications}
                      disabled={saving}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="push-notifications" className="text-sm font-medium">
                        Push notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Get instant alerts on your device
                      </p>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={pushNotifications}
                      onCheckedChange={handlePushNotifications}
                      disabled={saving}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="trip-reminders" className="text-sm font-medium">
                        Trip reminders
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Get reminded about upcoming trips and activities
                      </p>
                    </div>
                    <Switch
                      id="trip-reminders"
                      checked={tripReminders}
                      onCheckedChange={handleTripReminders}
                      disabled={saving}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="price-alerts" className="text-sm font-medium">
                        Price alerts
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Be notified when prices drop for saved destinations
                      </p>
                    </div>
                    <Switch
                      id="price-alerts"
                      checked={priceAlerts}
                      onCheckedChange={handlePriceAlerts}
                      disabled={saving}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="budget-alerts" className="text-sm font-medium">
                        Budget guidance
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Show helpful indicators when selections exceed your budget
                      </p>
                    </div>
                    <Switch
                      id="budget-alerts"
                      checked={budgetAlerts}
                      onCheckedChange={(checked) => {
                        setBudgetAlerts(checked);
                        savePreference('budget_alerts', checked);
                      }}
                      disabled={saving}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="marketing" className="text-sm font-medium">
                        Marketing emails
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive travel tips, deals, and inspiration
                      </p>
                    </div>
                    <Switch
                      id="marketing"
                      checked={marketingEmails}
                      onCheckedChange={handleMarketingEmails}
                      disabled={saving}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Travel Agent Mode Section */}
            <motion.div variants={itemVariants}>
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Travel Agent Mode</CardTitle>
                      <CardDescription>Professional tools for managing client trips</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="travel-agent-mode" className="text-sm font-medium">
                        Enable Travel Agent Mode
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Access CRM tools to manage clients and build itineraries for them
                      </p>
                    </div>
                    <Switch
                      id="travel-agent-mode"
                      checked={travelAgentMode}
                      onCheckedChange={(checked) => {
                        setTravelAgentMode(checked);
                        savePreference('travel_agent_mode', checked);
                      }}
                      disabled={saving}
                    />
                  </div>
                  
                  {travelAgentMode && (
                    <>
                      <Separator />
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="agent-business-name" className="text-sm font-medium">
                            Business Name (optional)
                          </Label>
                          <Input
                            id="agent-business-name"
                            placeholder="Your Travel Agency"
                            value={agentBusinessName}
                            onChange={(e) => setAgentBusinessName(e.target.value)}
                            onBlur={() => {
                              if (agentBusinessName !== '') {
                                savePreference('agent_business_name', agentBusinessName);
                              }
                            }}
                          />
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button 
                            onClick={() => navigate('/agent')}
                            className="gap-2"
                          >
                            <Users className="h-4 w-4" />
                            Open Client Dashboard
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => navigate('/agent/clients/new')}
                            className="gap-2"
                          >
                            Add New Client
                          </Button>
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          Manage your travel clients, store their preferences, and build custom itineraries. 
                          Track bookings and revenue to grow your travel business.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Linked Accounts Section - Only Google */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Link2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Linked accounts</CardTitle>
                      <CardDescription>Connect your social accounts for easy sign-in</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Google */}
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white border flex items-center justify-center">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-sm">Google</div>
                        <div className="text-sm text-muted-foreground">
                          {linkedAccounts[0].connected ? linkedAccounts[0].email : 'Not connected'}
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant={linkedAccounts[0].connected ? "outline" : "default"}
                      size="sm"
                      disabled
                    >
                      {linkedAccounts[0].connected ? 'Connected' : 'Connect'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Security Section */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Shield className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Security</CardTitle>
                      <CardDescription>Manage your account security</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <button 
                    onClick={() => setShowPasswordDialog(true)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <KeyRound className="w-5 h-5 text-muted-foreground" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Change password</div>
                        <div className="text-sm text-muted-foreground">
                          Update your account password
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Danger Zone */}
            <motion.div variants={itemVariants}>
              <Card className="border-destructive/20">
                <CardHeader>
                  <CardTitle className="text-lg text-destructive">Danger zone</CardTitle>
                  <CardDescription>Irreversible account actions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="w-full justify-start gap-3"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        disabled={deletingAccount}
                      >
                        {deletingAccount ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Delete account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your
                          account and remove all your data including saved trips, preferences,
                          and quiz responses.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteAccount}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>
      
      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your new password below. Password must be at least 6 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
