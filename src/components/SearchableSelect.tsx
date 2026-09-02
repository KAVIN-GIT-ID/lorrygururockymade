import { createSignal, createEffect, onMount, mergeProps } from 'solid-js';
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

export default function SearchableSelect(rawProps: SearchableSelectProps) {
  const props = mergeProps(
    {
      placeholder: 'Select option...',
      required: false,
      className: '',
      disabled: false,
      allowCustomVal: false
    },
    rawProps
  );

  const [isOpen, setIsOpen] = createSignal(false);
  const [search, setSearch] = createSignal('');
  const [highlightedIndex, setHighlightedIndex] = createSignal(-1);
  let containerRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  // Sync search() with selected value when dropdown is closed
  createEffect(() => {
    if (!isOpen()) {
      const selectedOpt = (props.options || []).find(opt => opt.value === props.value);
      setSearch(selectedOpt ? selectedOpt.label : (props.allowCustomVal ? props.value : ''));
    }
  });

  // Filter options based on search() query
  const filteredOptions = () => (props.options || []).filter(opt =>
    opt.label.toLowerCase().includes((search() || '').toLowerCase()) ||
    opt.value.toLowerCase().includes((search() || '').toLowerCase())
  );

  // Reset highlight index when filtered options change
  createEffect(() => {
    filteredOptions();
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
    if (props.disabled) return;

    const list = filteredOptions();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(prev => {
        const next = prev + 1;
        return next >= list.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(prev => {
        const next = prev - 1;
        return next < 0 ? list.length - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen() && highlightedIndex() >= 0 && highlightedIndex() < list.length) {
        const selected = list[highlightedIndex()];
        if (!selected.disabled) {
          props.onChange(selected.value);
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

  const handleInputChange = (val: string) => {
    setSearch(val);
    setIsOpen(true);
    
    const opts = props.options || [];
    const exactMatch = opts.find(opt => 
      !opt.disabled && 
      (opt.value.toLowerCase() === val.toLowerCase() || opt.label.toLowerCase() === val.toLowerCase())
    );
    if (exactMatch) {
      props.onChange(exactMatch.value);
    } else if (props.allowCustomVal) {
      props.onChange(val);
    }
  };

  return (
    <div ref={containerRef} class={`relative ${props.className}`}>
      <div class="relative">
        <input
          id={props.id}
          ref={inputRef}
          type="text"
          value={search()}
          placeholder={props.placeholder}
          disabled={props.disabled}
          required={props.required}
          autocomplete="off"
          onInput={(e) => handleInputChange((e.target as HTMLInputElement).value)}
          onChange={(e) => handleInputChange((e.target as HTMLInputElement).value)}
          onFocus={() => {
            setIsOpen(true);
            setSearch('');
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

      {isOpen() && !props.disabled && (
        <div class="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-750">
          {filteredOptions().length === 0 ? (
            <div class="px-3 py-2 text-xs text-slate-400 italic">No matches found</div>
          ) : (
            filteredOptions().map((opt, idx) => {
              const isSelected = opt.value === props.value;
              const isHighlighted = idx === highlightedIndex();
              return (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!opt.disabled) {
                      props.onChange(opt.value);
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
