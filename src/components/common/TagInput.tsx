import { motion, AnimatePresence } from 'framer-motion';
import { User, X, BadgeCheck } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  label: string;
  avatar?: string;
  secondaryText?: string;
  metadata?: {
    userId?: string;
    username?: string;
    verified?: boolean;
  };
}

interface TagInputProps {
  placeholder?: string;
  tags: Tag[];
  onAddTag: (tag: Tag) => void;
  onRemoveTag: (id: string) => void;
  onSearch: (query: string) => Promise<Tag[]>;
  className?: string;
  maxTags?: number;
  disabled?: boolean;
}

export default function TagInput({
  placeholder = 'Add a tag...',
  tags,
  onAddTag,
  onRemoveTag,
  onSearch,
  className,
  maxTags = 10,
  disabled = false
}: TagInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    const debounce = setTimeout(async () => {
      try {
        const searchResults = await onSearch(query);
        const filteredResults = searchResults.filter(
          result => !tags.some(tag => tag.id === result.id)
        );
        setResults(filteredResults);
        setIsOpen(filteredResults.length > 0);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, onSearch, tags]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current && 
        !resultsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = (tag: Tag) => {
    if (tags.length >= maxTags) return;
    onAddTag(tag);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleRemoveTag = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onRemoveTag(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (results.length > 0) {
        handleAddTag(results[0]);
      }
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div 
        className={cn(
          'flex flex-wrap items-center gap-2 p-2 border rounded-xl transition-all bg-background',
          isFocused ? 'border-primary ring-2 ring-primary/20' : 'border-border'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <AnimatePresence>
          {tags.map((tag) => (
            <motion.div
              key={tag.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-full text-sm"
            >
              {tag.avatar ? (
                <img 
                  src={tag.avatar} 
                  alt={tag.label} 
                  className="w-5 h-5 rounded-full object-cover" 
                />
              ) : (
                <User className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-foreground">{tag.label}</span>
              {tag.secondaryText && (
                <span className="text-muted-foreground text-xs">
                  {tag.secondaryText}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => handleRemoveTag(tag.id, e)}
                className="p-0.5 rounded-full hover:bg-background text-muted-foreground"
                aria-label={`Remove ${tag.label}`}
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex-1 min-w-[150px]">
          <input
            ref={inputRef}
            type="text"
            className="w-full py-1 px-2 focus:outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
            placeholder={tags.length > 0 ? '' : placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              if (query.trim() && results.length > 0) setIsOpen(true);
            }}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            disabled={disabled || tags.length >= maxTags}
          />

          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={resultsRef}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute z-10 mt-1 w-full rounded-lg bg-card shadow-lg border border-border overflow-hidden"
              >
                {isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
                    <p className="mt-2 text-sm">Searching...</p>
                  </div>
                ) : results.length > 0 ? (
                  <ul className="max-h-60 overflow-auto py-2">
                    {results.map((result, index) => (
                      <motion.li
                        key={result.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="px-4 py-2 hover:bg-muted cursor-pointer"
                        onClick={() => handleAddTag(result)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={handleKeyDown}
                      >
                        <div className="flex items-center gap-2">
                          {result.avatar ? (
                            <img 
                              src={result.avatar} 
                              alt={result.label}
                              className="w-8 h-8 rounded-full object-cover" 
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-foreground">{result.label}</span>
                              {result.metadata?.verified && (
                                <BadgeCheck className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            {result.secondaryText && (
                              <span className="text-xs text-muted-foreground">
                                {result.secondaryText}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    No results found. Type a name to search.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export type { Tag, TagInputProps };
