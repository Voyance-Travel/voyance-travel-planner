import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface Option {
  value: string;
  label: string;
  secondaryText?: string;
  icon?: string | React.ReactNode;
}

interface AutoCompleteSelectProps {
  placeholder?: string;
  value?: Option | null;
  onChange: (option: Option | null) => void;
  onSearch: (query: string) => Promise<Option[]>;
  defaultOptions?: Option[];
  className?: string;
  isAsync?: boolean;
  icon?: React.ReactNode;
  noResultsMessage?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export default function AutoCompleteSelect({
  placeholder = "Search...",
  value,
  onChange,
  onSearch,
  defaultOptions = [],
  className = "",
  isAsync = true,
  icon = <Search className="h-4 w-4 text-muted-foreground" />,
  noResultsMessage = "No results found",
  disabled = false,
  clearable = true
}: AutoCompleteSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>(defaultOptions);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    if (!isAsync || !query.trim()) {
      setOptions(defaultOptions);
      return;
    }

    setIsLoading(true);
    const debounce = setTimeout(async () => {
      try {
        const results = await onSearch(query);
        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, onSearch, isAsync, defaultOptions]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: Option) => {
    onChange(option);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsOpen(true);

    if (!newQuery.trim()) {
      setOptions(defaultOptions);
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setIsOpen(true);
  };

  const handleInputBlur = () => {
    setIsFocused(false);
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {icon}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={value ? value.label : query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full pl-10 pr-10 py-2 border border-border rounded-lg bg-background
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
            ${isFocused ? 'ring-2 ring-primary border-transparent' : ''}
          `}
        />

        {clearable && value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Searching...
              </div>
            ) : options.length > 0 ? (
              options.map((option, index) => (
                <motion.div
                  key={option.value}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelect(option)}
                  className="px-4 py-3 cursor-pointer hover:bg-accent flex items-center gap-3"
                >
                  {option.icon && (
                    <div className="flex-shrink-0">
                      {typeof option.icon === 'string' ? (
                        <span className="text-lg">{option.icon}</span>
                      ) : (
                        option.icon
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {option.label}
                    </div>
                    {option.secondaryText && (
                      <div className="text-sm text-muted-foreground truncate">
                        {option.secondaryText}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {noResultsMessage}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
