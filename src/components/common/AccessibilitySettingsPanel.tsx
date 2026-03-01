import { Accessibility, Eye, Type, Zap, Palette } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAccessibilityStore } from '@/stores/accessibility-store';
import { Button } from '@/components/ui/button';

export function AccessibilitySettingsPanel() {
  const {
    largerText, setLargerText,
    highContrast, setHighContrast,
    reducedMotion, setReducedMotion,
    differentiateWithoutColor, setDifferentiateWithoutColor,
  } = useAccessibilityStore();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Accessibility settings"
        >
          <Accessibility className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-serif">
            <Accessibility className="h-5 w-5 text-primary" />
            Accessibility
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Larger Text */}
          <SettingRow
            icon={<Type className="h-4 w-4" />}
            label="Larger Text"
            description="Increase base font size for easier reading"
            checked={largerText}
            onChange={setLargerText}
            id="a11y-larger-text"
          />

          <Separator />

          {/* High Contrast */}
          <SettingRow
            icon={<Eye className="h-4 w-4" />}
            label="High Contrast"
            description="Increase color contrast for better visibility"
            checked={highContrast}
            onChange={setHighContrast}
            id="a11y-high-contrast"
          />

          <Separator />

          {/* Reduced Motion */}
          <SettingRow
            icon={<Zap className="h-4 w-4" />}
            label="Reduced Motion"
            description="Minimize animations and transitions"
            checked={reducedMotion}
            onChange={setReducedMotion}
            id="a11y-reduced-motion"
          />

          <Separator />

          {/* Differentiate Without Color */}
          <SettingRow
            icon={<Palette className="h-4 w-4" />}
            label="Differentiate Without Color"
            description="Add patterns, icons, or underlines so color isn't the only indicator"
            checked={differentiateWithoutColor}
            onChange={setDifferentiateWithoutColor}
            id="a11y-no-color-only"
          />
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Your preferences are saved locally and will persist across sessions.
        </p>
      </SheetContent>
    </Sheet>
  );
}

function SettingRow({
  icon,
  label,
  description,
  checked,
  onChange,
  id,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex gap-3">
        <div className="mt-0.5 text-primary">{icon}</div>
        <div>
          <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}
