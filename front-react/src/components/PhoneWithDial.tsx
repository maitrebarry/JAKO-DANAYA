import { useState, useEffect, useRef } from 'react';
import PhoneInput from './PhoneInput';
import { getExpectedNationalLengths, isNationalNumberValid } from '../utils/phoneRules';

export default function PhoneWithDial({ value, defaultCountry, onChange }: { value?: string, defaultCountry?: string, onChange: (full?: string, code?: string, valid?: boolean, dial?: string, national?: string) => void }) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [code, setCode] = useState<string | undefined>(defaultCountry ? defaultCountry.toUpperCase() : undefined);
  const [paysList, setPaysList] = useState<any[]>([]);
  const phoneRef = useRef<any>(null);

  useEffect(() => {
    setCode(defaultCountry ? defaultCountry.toUpperCase() : undefined);
  }, [defaultCountry]);

  useEffect(() => {
    // fetch /api/pays for options; fallback not critical here
    (async () => {
      try {
        const token = localStorage.getItem('smb_token');
        const res = await fetch('http://localhost:8085/api/pays', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const data = await res.json();
          setPaysList(data || []);
        }
      } catch (e) {
        console.warn('Could not load pays list', e);
      }
    })();
  }, []);

  const handleChange = (full?: string, c?: string, valid?: boolean, d?: string, n?: string) => {
    // If we have a rule, enforce national length
    const nationalValidity = isNationalNumberValid(c, n);
    const finalValid = nationalValidity === true ? true : (typeof valid === 'boolean' ? valid : null);

    setIsValid(finalValid === true ? true : (nationalValidity === false || valid === false ? false : null));

    onChange && onChange(full, c, finalValid === true, d, n);
  };

  const expected = getExpectedNationalLengths(code);

  const onCountrySelect = (selectedCode: string) => {
    setCode(selectedCode);
    const sel = paysList.find(p => (p.codeIso || '').toUpperCase() === (selectedCode || '').toUpperCase());
    const dialCode = sel && sel.indicatif ? (sel.indicatif.startsWith('+') ? sel.indicatif.replace('+', '') : sel.indicatif) : undefined;
    setIsValid(null);
    // instruct PhoneInput to switch country and update placeholder
    try { phoneRef.current?.setCountryISO(selectedCode); } catch (e) {}
    // notify parent we changed country and there's no valid number yet
    onChange && onChange('', selectedCode, false, dialCode, '');
  };

  return (
    <div className="d-flex align-items-start">
      <div style={{ minWidth: 96, marginRight: 8 }}>
        <select className="form-select form-select-sm" value={code || ''} onChange={(e) => onCountrySelect(e.target.value)} style={{ width: 96 }}>
          <option value="">Indic.</option>
          {paysList.map(p => (
            <option key={p.codeIso} value={p.codeIso} title={`${p.nom} (${p.codeIso})`}>
              {p.indicatif ? `+${String(p.indicatif).replace(/\s/g,'')}` : p.codeIso}
            </option>
          ))}
        </select>
        {expected && <small className="text-muted">Attendu: {expected.join('/')} chiffres</small>}
      </div>
      <div style={{ flex: 1 }}>
        <PhoneInput ref={phoneRef} value={value} defaultCountry={code || defaultCountry} onChange={handleChange} />
        {isValid === false && <div className="form-text text-danger">Numéro invalide ou longueur incorrecte pour le pays sélectionné.</div>}
      </div>
    </div>
  );
}
