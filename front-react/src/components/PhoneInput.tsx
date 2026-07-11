import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import 'intl-tel-input/build/css/intlTelInput.css';

declare global {
  interface Window { intlTelInput: any }
}

type PhoneInputHandle = {
  setCountryISO: (code?: string) => void
};

const getNationalDisplayValue = (value: string | undefined, dialCode?: string) => {
  if (!value) return '';
  const raw = value.toString().trim();
  if (!dialCode) return raw;

  const digits = raw.replace(/\D/g, '');
  const looksInternational = raw.startsWith('+') || raw.startsWith('00') || digits.length > 10;
  if (looksInternational && digits.startsWith(dialCode)) {
    return digits.substring(dialCode.length);
  }

  return raw;
};

const applyNationalPlaceholder = (input: HTMLInputElement | null) => {
  if (input) input.setAttribute('placeholder', '70000000');
};

const PhoneInput = forwardRef<PhoneInputHandle, { value?: string, onChange: (telephone?: string, codePays?: string, valid?: boolean, dialCode?: string, national?: string) => void, defaultCountry?: string }>(
  ({ value, onChange, defaultCountry }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const itiRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      setCountryISO: (code?: string) => {
        try {
          if (!itiRef.current) return;
          if (code) itiRef.current.setCountry((code || 'ml').toLowerCase());
          const country = itiRef.current.getSelectedCountryData();
          if (country && country.dialCode && inputRef.current) {
            applyNationalPlaceholder(inputRef.current);
            // Do not set the actual input value to the dial-only string (avoid sending incomplete number).
            try { onChange('', (code || '').toUpperCase(), false, country.dialCode, ''); } catch(e){}
          }
        } catch (err) { /* ignore */ }
      }
    }));

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!window.intlTelInput) {
        // dynamic import to ensure vite handles it. Vite/esbuild bundles this
        // CommonJS package as an ES module whose default export IS the
        // intlTelInput factory function — it is not attached to window as a
        // side effect (unlike the plain <script> UMD build). Without this,
        // window.intlTelInput stays undefined and initialization below throws,
        // silently leaving the input with no event listeners wired up (typed
        // phone numbers are then never captured into the form state).
        const mod: any = await import('intl-tel-input');
        window.intlTelInput = mod?.default || mod;
      }
      if (!inputRef.current || !mounted) return;

      // initialize once
      // @ts-ignore
      itiRef.current = window.intlTelInput(inputRef.current, {
        initialCountry: (defaultCountry || 'ml').toLowerCase(),
        utilsScript: 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js',
        separateDialCode: true,
        nationalMode: true
      });

      // Ensure the plugin picks the requested country and update placeholder
      try {
        if (defaultCountry) {
          itiRef.current.setCountry((defaultCountry || 'ml').toLowerCase());
        }
        const country = itiRef.current.getSelectedCountryData();
        if (country && country.dialCode) {
          applyNationalPlaceholder(inputRef.current);
          if (value) inputRef.current.value = getNationalDisplayValue(value, country.dialCode);
        } else if (value) {
          inputRef.current.value = value;
        }
      } catch (err) { /* ignore */ }

      const onNumberOrCountryChange = () => {
        if (!itiRef.current || !inputRef.current) return;
        const rawValue = (inputRef.current.value || '').toString();
        const tel = itiRef.current.getNumber();
        const country = itiRef.current.getSelectedCountryData();
        const code = country && country.iso2 ? country.iso2.toUpperCase() : '';
        // update placeholder on country change/selection
        if (country && country.dialCode) {
          applyNationalPlaceholder(inputRef.current);
        }
        // compute validity when available
        const valid = typeof itiRef.current.isValidNumber === 'function' ? itiRef.current.isValidNumber() : undefined;
        const dial = country && country.dialCode ? country.dialCode : undefined;
        // derive national number by stripping dial code from E.164 number if possible
        let national: string | undefined = undefined;
        try {
          if (tel && dial && typeof tel === 'string') {
            const cleaned = tel.replace(/\D/g, '');
            if (cleaned.startsWith(dial)) {
              national = cleaned.substring(dial.length);
            } else {
              national = cleaned;
            }
          } else {
            // fallback: use raw input value (user may have typed only local number without intl formatting)
            const rawClean = rawValue.replace(/\D/g, '');
            if (rawClean.length > 0) {
              // if raw starts with dial digits, strip them
              if (dial && rawClean.startsWith(dial)) {
                national = rawClean.substring(dial.length);
              } else {
                national = rawClean;
              }
            }
          }
        } catch (e) { /* ignore */ }

        // Determine what to send as full E.164 number when possible.
        let full: string | undefined = undefined;
        if (tel && typeof tel === 'string' && tel.trim().length > 0) {
          full = tel;
        } else if (dial && national) {
          full = `+${dial}${national}`;
        } else if (rawValue && rawValue.trim().length > 0) {
          full = rawValue;
        }

        onChange(full, code, valid, dial, national);
      };

      inputRef.current.addEventListener('blur', onNumberOrCountryChange);
      inputRef.current.addEventListener('change', onNumberOrCountryChange);
      inputRef.current.addEventListener('input', onNumberOrCountryChange);
      inputRef.current.addEventListener('countrychange', onNumberOrCountryChange as any);

      return () => {
        mounted = false;
        try {
          if (inputRef.current) {
            inputRef.current.removeEventListener('blur', onNumberOrCountryChange);
            inputRef.current.removeEventListener('change', onNumberOrCountryChange);
            inputRef.current.removeEventListener('input', onNumberOrCountryChange);
            inputRef.current.removeEventListener('countrychange', onNumberOrCountryChange as any);
          }
          if (itiRef.current && typeof itiRef.current.destroy === 'function') {
            itiRef.current.destroy();
          }
        } catch (err) { /* ignore cleanup errors */ }
      };
    })();
  }, []);

  // If defaultCountry changes after initialization, update the selected country and placeholder
  useEffect(() => {
    if (!itiRef.current) return;

    const applyPlaceholder = () => {
      try {
        const country = itiRef.current.getSelectedCountryData();
        if (country && country.dialCode && inputRef.current) {
          applyNationalPlaceholder(inputRef.current);
          // Do NOT write the dial code into the input's text value: intl-tel-input
          // already shows it separately via the flag selector (separateDialCode: true).
          // Writing it here would duplicate it inside the field itself.
          try { onChange('', (defaultCountry || '').toUpperCase(), false, country.dialCode, ''); } catch(e){}
          return true;
        }
        // fallback: try to get country data from global helper
        const globals: any = (window as any).intlTelInputGlobals || (window as any).intlTelInput ? (window as any).intlTelInputGlobals : null;
        if (globals && typeof globals.getCountryData === 'function') {
          const list = globals.getCountryData();
          const found = list.find((c: any) => (c.iso2 || '').toLowerCase() === (defaultCountry || 'ml').toLowerCase());
          if (found && found.dialCode && inputRef.current) {
            const dial = found.dialCode;
            applyNationalPlaceholder(inputRef.current);
            // Do NOT prefill the input with only the dial code (that would be an incomplete number).
            // Instead notify parent that the country changed and there is no valid number yet and supply the dial code
            try {
              onChange('', (defaultCountry || '').toUpperCase(), false, dial, '');
            } catch(e) { /* ignore */ }
            return true;
          }
        }
      } catch (err) {
        // ignore
      }
      return false;
    };

    try {
      if (defaultCountry) {
        itiRef.current.setCountry((defaultCountry || 'ml').toLowerCase());
      }
    } catch (err) { /* ignore */ }

    // Try immediately and retry a few times in case the plugin or utils script is not ready
    if (!applyPlaceholder()) {
      const tries = [50, 200, 600];
      tries.forEach((ms) => setTimeout(() => { try { applyPlaceholder(); } catch(e){}} , ms));
    }
  }, [defaultCountry]);

  // expose helper for parent to force country and placeholder
  // (handled by useImperativeHandle above)

  useEffect(() => {
    if (inputRef.current && value != null) {
      let dial: string | undefined;
      try {
        const country = itiRef.current?.getSelectedCountryData?.();
        dial = country?.dialCode;
      } catch (err) { /* ignore */ }

      const displayValue = getNationalDisplayValue(value, dial);
      if (inputRef.current.value !== displayValue) {
        inputRef.current.value = displayValue;
      }
    }
  }, [value]);

  return (
    <input ref={inputRef} className="form-control" placeholder="70000000" />
  );
});

export default PhoneInput;
