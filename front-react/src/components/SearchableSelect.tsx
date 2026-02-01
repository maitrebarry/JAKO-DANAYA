import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface Option {
  value: string | number;
  label: string;
  disabled?: boolean;
  // optional depot label to display as a badge next to the option
  depot?: string;
}

interface Props {
  options: Option[];
  value?: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  allowClear?: boolean;
}

const SearchableSelect: React.FC<Props> = ({ options, value, onChange, placeholder = 'Rechercher...', allowClear = true }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => options.find(o => String(o.value) === String(value)), [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => setHighlight(0), [filtered]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  // toggleOpen removed — using setOpen(true/false) explicitly in event handlers

  const handleSelect = (opt: Option) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) handleSelect(opt);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="searchable-select" ref={ref} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          className="form-control"
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : (selected ? selected.label : '')}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
        />
        {allowClear && selected && (
          <button type="button" className="btn btn-outline-secondary" onClick={() => onChange(null)} title="Effacer">
            &times;
          </button>
        )}
      </div>

      {open && (
        <div className="listbox shadow bg-white" role="listbox" style={{ position: 'absolute', zIndex: 9999, width: '100%', maxHeight: 300, overflowY: 'auto', border: '1px solid #ddd' }}>
          {filtered.length === 0 ? (
            <div className="p-2 text-muted">Aucun résultat</div>
          ) : (
            filtered.map((opt, idx) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={String(value) === String(opt.value)}
                className={`p-2 ${idx === highlight ? 'bg-primary text-white' : ''} ${opt.disabled ? 'text-muted' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlight(idx)}
                style={{ cursor: opt.disabled ? 'not-allowed' : 'pointer' }}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
