import { useState } from 'react';
import { Copy, ExternalLink, LinkIcon, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { generateIntakeLink, toggleIntakeEnabled, type AgencyAccount } from '@/services/agencyCRM';
import { toast } from '@/hooks/use-toast';
import { getAppUrl } from '@/utils/getAppUrl';

interface IntakeLinkCardProps {
  account: AgencyAccount;
  onUpdate: () => void;
}

export default function IntakeLinkCard({ account, onUpdate }: IntakeLinkCardProps) {
  const [generating, setGenerating] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  const intakeUrl = account.intake_token 
    ? `${getAppUrl()}/intake/${account.intake_token}`
    : null;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateIntakeLink(account.id);
      toast({ title: 'Intake link created!' });
      onUpdate();
    } catch (error) {
      console.error('Error generating intake link:', error);
      toast({ title: 'Failed to create intake link', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      await toggleIntakeEnabled(account.id, enabled);
      toast({ title: enabled ? 'Intake form enabled' : 'Intake form disabled' });
      onUpdate();
    } catch (error) {
      console.error('Error toggling intake:', error);
      toast({ title: 'Failed to update intake settings', variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  const handleCopy = async () => {
    if (!intakeUrl) return;
    await navigator.clipboard.writeText(intakeUrl);
    setCopied(true);
    toast({ title: 'Link copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Client Intake Form
        </CardTitle>
        <CardDescription>
          Share a link with clients to collect their travel profile information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!account.intake_token ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Generate an intake form link that clients can use to submit their traveler information.
            </p>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Generate Intake Link
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="intake-enabled"
                  checked={account.intake_enabled || false}
                  onCheckedChange={handleToggle}
                  disabled={toggling}
                />
                <Label htmlFor="intake-enabled" className="cursor-pointer">
                  {account.intake_enabled ? 'Form is active' : 'Form is disabled'}
                </Label>
              </div>
              {account.intake_enabled && (
                <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full">
                  Live
                </span>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Intake Form URL</Label>
              <div className="flex gap-2">
                <Input 
                  value={intakeUrl || ''} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleCopy} aria-label={copied ? "Link copied" : "Copy link"}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => window.open(intakeUrl!, '_blank')}
                  disabled={!account.intake_enabled}
                  aria-label="Open intake link in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              When clients submit this form, their information will automatically create a traveler profile under this account.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}