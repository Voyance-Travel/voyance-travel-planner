/**
 * Trip Cart Component
 * 
 * Persistent cart widget showing items in "selected_pending" state.
 * Displays count, subtotal, and checkout button.
 */

import { useState } from 'react';
import { ShoppingCart, ChevronDown, ChevronUp, X, Clock, AlertTriangle, CreditCard, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useTripCart, formatCartPrice, type CartItem } from '@/hooks/useTripCart';
import { getQuoteTimeRemaining, isQuoteValid } from '@/services/bookingStateMachine';

interface TripCartProps {
  tripId: string;
  onCheckout?: () => void;
  onItemClick?: (item: CartItem) => void;
  className?: string;
}

export function TripCart({ tripId, onCheckout, onItemClick, className }: TripCartProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const cart = useTripCart(tripId);

  if (cart.itemCount === 0) {
    return null;
  }

  return (
    <div className={cn('fixed bottom-4 right-4 z-50 w-80', className)}>
      <Card className="shadow-lg border-primary/20">
        {/* Cart Header - Always Visible */}
        <CardHeader 
          className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <Badge 
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  variant="default"
                >
                  {cart.itemCount}
                </Badge>
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Trip Cart</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {cart.itemCount} item{cart.itemCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                {formatCartPrice(cart.subtotalCents, cart.currency)}
              </span>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          
          {cart.hasExpiredQuotes && (
            <div className="flex items-center gap-1.5 mt-2 text-amber-600 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Some quotes have expired</span>
            </div>
          )}
        </CardHeader>

        {/* Expanded Cart Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Separator />
              <ScrollArea className="max-h-64">
                <CardContent className="p-3 space-y-2">
                  {cart.items.map((item) => (
                    <CartItemRow 
                      key={item.id} 
                      item={item}
                      onRemove={() => cart.removeFromCart(item.id)}
                      onClick={() => onItemClick?.(item)}
                      isRemoving={cart.isRemoving}
                    />
                  ))}
                </CardContent>
              </ScrollArea>
              <Separator />
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">
                    {formatCartPrice(cart.subtotalCents, cart.currency)}
                  </span>
                </div>
                <Button 
                  className="w-full gap-2" 
                  onClick={onCheckout}
                >
                  <CreditCard className="h-4 w-4" />
                  Proceed to Checkout
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

interface CartItemRowProps {
  item: CartItem;
  onRemove: () => void;
  onClick?: () => void;
  isRemoving: boolean;
}

function CartItemRow({ item, onRemove, onClick, isRemoving }: CartItemRowProps) {
  const quoteValid = isQuoteValid(item.quoteExpiresAt);
  const timeRemaining = getQuoteTimeRemaining(item.quoteExpiresAt);

  return (
    <div 
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {item.vendorName && <span>{item.vendorName}</span>}
          {item.quoteExpiresAt && (
            <div className={cn(
              'flex items-center gap-1',
              !quoteValid && 'text-amber-600'
            )}>
              <Clock className="h-3 w-3" />
              <span>{timeRemaining}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium whitespace-nowrap">
          {formatCartPrice(item.priceCents, item.currency)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={isRemoving}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Compact cart badge for header/toolbar
 */
interface TripCartBadgeProps {
  tripId: string;
  onClick?: () => void;
}

export function TripCartBadge({ tripId, onClick }: TripCartBadgeProps) {
  const cart = useTripCart(tripId);

  if (cart.itemCount === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 relative"
      onClick={onClick}
    >
      <ShoppingCart className="h-4 w-4" />
      <Badge 
        className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0 flex items-center justify-center text-xs"
        variant="default"
      >
        {cart.itemCount}
      </Badge>
      <span className="hidden sm:inline">{formatCartPrice(cart.subtotalCents, cart.currency)}</span>
    </Button>
  );
}
