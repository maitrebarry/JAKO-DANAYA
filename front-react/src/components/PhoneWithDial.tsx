import { useState, useEffect } from 'react';
import PhoneInput from './PhoneInput';
import { getExpectedNationalLengths, isNationalNumberValid } from '../utils/phoneRules';

export default function PhoneWithDial({ value, defaultCountry, onChange }: { value?: string, defaultCountry?: string, onChange: (full?: string, code?: string, valid?: boolean, dial?: string, national?: string) => void }) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [code, setCode] = useState<string | undefined>(defaultCountry ? defaultCountry.toUpperCase() : undefined);

  useEffect(() => {
    setCode(defaultCountry ? defaultCountry.toUpperCase() : undefined);
  }, [defaultCountry]);

  const handleChange = (full?: string, c?: string, valid?: boolean, d?: string, n?: string) => {
    // PhoneInput (intl-tel-input) est l'unique sélecteur de pays affiché : garder
    // "code" synchronisé avec son propre changement de pays (drapeau) évite d'avoir
    // un second sélecteur redondant et garantit que la règle de longueur appliquée
    // (ci-dessous) correspond toujours au pays réellement sélectionné dans le champ.
    if (c) setCode(c.toUpperCase());

    // Si une règle de longueur existe pour ce pays, elle est prioritaire sur la
    // validation générique de la librairie (qui peut accepter des longueurs que
    // notre règle explicite rejette, ex: 9 chiffres pour le Mali au lieu de 8).
    const nationalValidity = isNationalNumberValid(c, n);
    const finalValid = nationalValidity !== null ? nationalValidity : (typeof valid === 'boolean' ? valid : null);

    setIsValid(finalValid);

    onChange && onChange(full, c, finalValid === true, d, n);
  };

  const expected = getExpectedNationalLengths(code);

  return (
    <div>
      <PhoneInput value={value} defaultCountry={defaultCountry} onChange={handleChange} />
      {expected && <small className="text-muted">Attendu: {expected.join('/')} chiffres</small>}
      {isValid === false && <div className="form-text text-danger">Numéro invalide ou longueur incorrecte pour le pays sélectionné.</div>}
    </div>
  );
}
