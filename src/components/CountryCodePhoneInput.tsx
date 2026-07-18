import { createSignal, createEffect } from 'solid-js';


interface CountryCodePhoneInputProps {
  value: string; // E.164 format (e.g. +919876543210)
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  class?: string;
  className?: string;
}

const COUNTRY_CODES = [
  { code: '+91', name: 'India (IN)', flag: '🇮🇳' },
  { code: '+1', name: 'USA / Canada (US/CA)', flag: '🇺🇸' },
  { code: '+44', name: 'United Kingdom (UK)', flag: '🇬🇧' },
  { code: '+971', name: 'UAE (AE)', flag: '🇦🇪' },
  { code: '+966', name: 'Saudi Arabia (SA)', flag: '🇸🇦' },
  { code: '+65', name: 'Singapore (SG)', flag: '🇸🇬' },
  { code: '+974', name: 'Qatar (QA)', flag: '🇶🇦' },
  { code: '+968', name: 'Oman (OM)', flag: '🇴🇲' },
  { code: '+965', name: 'Kuwait (KW)', flag: '🇰🇼' },
  { code: '+973', name: 'Bahrain (BH)', flag: '🇧🇭' },
  { code: '+61', name: 'Australia (AU)', flag: '🇦🇺' },
];

export default function CountryCodePhoneInput({
  value,
  onChange,
  placeholder = 'Enter mobile number',
  required = false,
  disabled = false,
  id,
  class: classVal = '',
  className = '',
}: CountryCodePhoneInputProps) {
  // Parse initial country code and local number
  const getInitialParts = (fullVal: string) => {
    const matched = COUNTRY_CODES.find((c) => fullVal.startsWith(c.code));
    if (matched) {
      return {
        country: matched.code,
        local: fullVal.substring(matched.code.length),
      };
    }
    // Default fallback to India (+91)
    return {
      country: '+91',
      local: fullVal.startsWith('+') ? fullVal.replace(/^\+\d+/, '') : fullVal,
    };
  };

  const initialParts = getInitialParts(value);
  const [selectedCountry, setSelectedCountry] = createSignal(initialParts.country);
  const [localNumber, setLocalNumber] = createSignal(initialParts.local);

  // Sync internal state when external value changes (unless it's matching the current combined string)
  createEffect(() => {
    const parts = getInitialParts(value);
    setSelectedCountry(parts.country);
    setLocalNumber(parts.local);
  });

  const handleCountryChange = (e: any) => {
    const newCountry = e.target.value;
    setSelectedCountry(newCountry);
    const cleanedLocal = localNumber().replace(/[^0-9]/g, '');
    onChange(cleanedLocal ? `${newCountry}${cleanedLocal}` : '');
  };

  const handleLocalNumberChange = (e: any) => {
    const input = e.target.value;
    const cleanedLocal = input.replace(/[^0-9]/g, ''); // strip non-numeric
    setLocalNumber(cleanedLocal);
    onChange(cleanedLocal ? `${selectedCountry()}${cleanedLocal}` : '');
  };

  return (
    <div class={`flex rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-hidden ${disabled ? 'opacity-65 cursor-not-allowed' : ''} ${className || classVal}`}>
      {/* Country Code Select Dropdown */}
      <select
        value={selectedCountry()}
        onChange={handleCountryChange}
        disabled={disabled}
        class="bg-slate-50 dark:bg-slate-950 text-current text-xs px-2.5 py-2 border-r border-slate-200 dark:border-slate-800 outline-none focus:ring-0 cursor-pointer font-bold shrink-0 max-w-[95px] md:max-w-[110px]"
        title="Select Country Code"
      >
        {COUNTRY_CODES.map((c) => (
          <option  value={c.code} class="bg-white dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100">
            {c.flag} {c.code}
          </option>
        ))}
      </select>

      {/* Local Number Input */}
      <input
        type="tel"
        id={id}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={localNumber()}
        onChange={handleLocalNumberChange}
        class="w-full bg-transparent text-current text-xs px-3 py-2 outline-none focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 font-mono"
      />
    </div>
  );
}
