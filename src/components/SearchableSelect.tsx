import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';

import { ChevronDown, Check } from 'lucide-solid';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  allowCustomVal?: boolean;
}

export default function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  required = false,
  className = '',
  disabled = false,
  allowCustomVal = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [search, setSearch] = createSignal('');
  const [highlightedIndex, setHighlightedIndex] = createSignal(-1);
  let containerRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  // Sync search() with selected value when dropdown is closed
  onMount(() => {
    if (!isOpen()) {
      const selectedOpt = options.find(opt => opt.value === value);
      setSearch(selectedOpt ? selectedOpt.label : (allowCustomVal ? value : ''));
    }
  });

  // Filter options based on search() query
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search().toLowerCase()) ||
    opt.value.toLowerCase().includes(search().toLowerCase())
  );

  // Reset highlight index when filtered options change
  createEffect(() => {
    setHighlightedIndex(-1);
  });

  // Handle click outside to close
  createEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef && !containerRef.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(prev => {
        const next = prev + 1;
        return next >= filteredOptions.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(prev => {
        const next = prev - 1;
        return next < 0 ? filteredOptions.length - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen() && highlightedIndex() >= 0 && highlightedIndex() < filteredOptions.length) {
        const selected = filteredOptions[highlightedIndex()];
        if (!selected.disabled) {
          onChange(selected.value);
          setIsOpen(false);
          inputRef?.blur();
        }
      } else if (!isOpen()) {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} class={`relative ${className}`}>
      <div class="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={search()}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autocomplete="off"
          onChange={(e) => {
            const val = e.target.value;
            setSearch(val);
            setIsOpen(true);
            
            const exactMatch = options.find(opt => 
              !opt.disabled && 
              (opt.value.toLowerCase() === val.toLowerCase() || opt.label.toLowerCase() === val.toLowerCase())
            );
            if (exactMatch) {
              onChange(exactMatch.value);
            } else if (allowCustomVal) {
              onChange(val);
            }
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch(''); // clear search() on focus to show all options
          }}
          onKeyDown={handleKeyDown}
          class="w-full bg-white dark:bg-slate-800 border border-slate-205 dark:border-slate-700 text-slate-800 dark:text-white rounded-lg pl-3 pr-8 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span 
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 cursor-pointer pointer-events-none"
        >
          <ChevronDown class="w-3.5 h-3.5" />
        </span>
      </div>

      {isOpen() && !disabled && (
        <div class="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-750">
          {filteredOptions.length === 0 ? (
            <div class="px-3 py-2 text-xs text-slate-400 italic">No matches found</div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex();
              return (
                <div
                  
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur before state update
                    if (!opt.disabled) {
                      onChange(opt.value);
                      setIsOpen(false);
                    }
                  }}
                  class={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition ${
                    opt.disabled
                      ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50'
                      : isHighlighted || isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'text-slate-700 dark:text-slate-205 hover:bg-slate-50 dark:hover:bg-slate-750 font-semibold'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check class="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
