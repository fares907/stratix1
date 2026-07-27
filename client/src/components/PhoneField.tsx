import { useLanguage } from "@/contexts/LanguageContext";
import {
  AsYouType,
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_COUNTRY: CountryCode = "EG";

// ISO-3166 alpha-2 → flag emoji via regional indicator symbols.
function flagEmoji(country: string) {
  return country
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

type CountryEntry = {
  code: CountryCode;
  callingCode: string;
  name: string;
  flag: string;
};

const copy = {
  ar: {
    searchPlaceholder: "ابحث عن دولة…",
    numberPlaceholder: "رقم الهاتف",
    invalid: "أدخل رقم هاتف صحيحاً للدولة المختارة",
    noResults: "لا توجد نتائج",
    selectCountry: "اختر الدولة",
  },
  en: {
    searchPlaceholder: "Search for a country…",
    numberPlaceholder: "Phone number",
    invalid: "Enter a valid phone number for the selected country",
    noResults: "No results",
    selectCountry: "Select country",
  },
};

export default function PhoneField() {
  const { language } = useLanguage();
  const text = copy[language];

  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [nationalNumber, setNationalNumber] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [touched, setTouched] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);

  // Localized country names come from the browser (Arabic or English) so we
  // never ship or maintain a hand-written country list.
  const countries = useMemo<CountryEntry[]>(() => {
    const displayNames = new Intl.DisplayNames([language], { type: "region" });
    return getCountries()
      .map(code => ({
        code,
        callingCode: getCountryCallingCode(code),
        name: displayNames.of(code) ?? code,
        flag: flagEmoji(code),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, language));
  }, [language]);

  const selected = countries.find(c => c.code === country);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return countries;
    return countries.filter(
      c =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query) ||
        c.callingCode.includes(query.replace(/^\+/, "")),
    );
  }, [countries, search]);

  // Only a number that validates against the selected country's rules is
  // exposed to the form, so a wrong number can never be submitted and come
  // back as a confusing server-side error. The server re-validates anyway.
  const e164 = useMemo(() => {
    if (!nationalNumber.trim()) return "";
    const parsed = parsePhoneNumberFromString(nationalNumber, country);
    return parsed?.isValid() ? parsed.number : "";
  }, [nationalNumber, country]);

  const isValid = e164.length > 0;
  const showError = touched && nationalNumber.trim().length > 0 && !isValid;

  // Block native form submission while the number is invalid.
  useEffect(() => {
    const input = numberRef.current;
    if (!input) return;
    input.setCustomValidity(isValid || !nationalNumber.trim() ? "" : text.invalid);
  }, [isValid, nationalNumber, text.invalid]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch("");
      // focus the search box once the dropdown paints
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const handleNumberChange = (raw: string) => {
    // Reduce to dialable characters before formatting: feeding already-spaced
    // text back into AsYouType on every keystroke garbles the grouping and
    // makes backspacing over a space behave oddly.
    const digits = raw.replace(/[^\d+]/g, "");
    setNationalNumber(new AsYouType(country).input(digits));
  };

  return (
    <div className="phone-field" ref={rootRef}>
      {/* The form reads this hidden field via FormData; server re-validates. */}
      <input type="hidden" name="phone" value={e164} />

      <div className="phone-field-row" dir="ltr">
        <button
          type="button"
          className="phone-country-trigger"
          onClick={() => setOpen(value => !value)}
          aria-label={text.selectCountry}
          aria-expanded={open}
        >
          <span className="phone-flag">{selected?.flag}</span>
          <span className="phone-dial">+{selected?.callingCode}</span>
          <ChevronDown aria-hidden="true" />
        </button>

        <input
          ref={numberRef}
          className="phone-number-input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder={text.numberPlaceholder}
          value={nationalNumber}
          onChange={event => handleNumberChange(event.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={showError}
          required
        />
      </div>

      {open && (
        <div className="phone-country-menu" dir={language === "ar" ? "rtl" : "ltr"}>
          <div className="phone-search">
            <Search aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={text.searchPlaceholder}
            />
          </div>
          <ul className="phone-country-list" role="listbox">
            {filtered.map(entry => (
              <li key={entry.code}>
                <button
                  type="button"
                  className="phone-country-option"
                  data-selected={entry.code === country}
                  onClick={() => {
                    setCountry(entry.code);
                    setOpen(false);
                    setTouched(true);
                  }}
                >
                  <span className="phone-flag">{entry.flag}</span>
                  <span className="phone-country-name">{entry.name}</span>
                  <span className="phone-dial" dir="ltr">+{entry.callingCode}</span>
                  {entry.code === country && <Check className="phone-check" aria-hidden="true" />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="phone-no-results">{text.noResults}</li>}
          </ul>
        </div>
      )}

      {showError && <p className="phone-error">{text.invalid}</p>}
    </div>
  );
}
