import React, { useState, useEffect } from 'react';

export interface CountryCodeItem {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRIES: CountryCodeItem[] = [
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
  { code: '+61', name: 'Australia (AU)', flag: '🇦🇺' }
];

interface CountryPhoneInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

export default function CountryPhoneInput({
  value = '',
  onChange,
  placeholder = 'Enter mobile number',
  required = false,
  disabled = false,
  id,
  name,
  className = ''
}: CountryPhoneInputProps) {
  const parsePhone = (val: string) => {
    const matched = COUNTRIES.find((c) => val.startsWith(c.code));
    if (matched) {
      return {
        country: matched.code,
        local: val.substring(matched.code.length)
      };
    }
    return {
      country: '+91',
      local: val.startsWith('+') ? val.replace(/^\+\d+/, '') : val
    };
  };

  const initial = parsePhone(value);
  const [selectedCountry, setSelectedCountry] = useState(initial.country);
  const [localNumber, setLocalNumber] = useState(initial.local);

  useEffect(() => {
    const parsed = parsePhone(value);
    setSelectedCountry(parsed.country);
    setLocalNumber(parsed.local);
  }, [value]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value;
    setSelectedCountry(newCountry);
    const clean = localNumber.replace(/[^0-9]/g, '');
    onChange(clean ? `${newCountry}${clean}` : '');
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let clean = e.target.value.replace(/[^0-9]/g, '');
    // If user pasted/typed 919025675495 while +91 is selected, strip redundant 91 prefix
    if (selectedCountry === '+91' && clean.length === 12 && clean.startsWith('91')) {
      clean = clean.substring(2);
    }
    setLocalNumber(clean);
    onChange(clean ? `${selectedCountry}${clean}` : '');
  };

  return (
    <div
      className={`flex rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all ${
        disabled ? 'opacity-65 cursor-not-allowed' : ''
      } ${className}`}
    >
      {/* Country Flag & Dial Code Select */}
      <select
        value={selectedCountry}
        onChange={handleCountryChange}
        disabled={disabled}
        className="bg-slate-50 dark:bg-slate-950 text-current text-xs px-2.5 py-2.5 border-r border-slate-200 dark:border-slate-800 outline-none focus:ring-0 cursor-pointer font-bold shrink-0 max-w-[110px]"
        title="Select Country Code"
      >
        {COUNTRIES.map((c) => (
          <option
            key={c.code}
            value={c.code}
            className="bg-white dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100"
          >
            {c.flag} {c.code}
          </option>
        ))}
      </select>

      {/* Local Phone Number Input */}
      <input
        type="tel"
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={localNumber}
        onChange={handleLocalChange}
        className="w-full bg-transparent text-current text-xs px-3 py-2.5 outline-none focus:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono tracking-wider"
      />
    </div>
  );
}
