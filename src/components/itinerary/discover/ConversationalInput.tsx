/**
 * ConversationalInput — "Looking for something specific?" text input for Discover
 */
import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ConversationalInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ConversationalInput({ onSubmit, isLoading, placeholder }: ConversationalInputProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setQuery('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder || "Looking for something specific?"}
        className="flex-1 h-9 text-sm bg-muted/50 border-border/50"
        disabled={isLoading}
      />
      <Button
        type="submit"
        size="sm"
        disabled={!query.trim() || isLoading}
        className="h-9 w-9 p-0 shrink-0"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </form>
  );
}
