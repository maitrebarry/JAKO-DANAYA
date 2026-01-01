import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { createDepense } from '../api/depense';
import RequirePermission from './RequirePermission';
import SearchableSelect from './SearchableSelect';
import { useUser } from '../contexts/UserContext';

const DepenseForm: React.FC<{ onCreated?: (d: any) => void }> = ({ onCreated }) => {
  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [referenceCaisse, setReferenceCaisse] = useState<string | null>(null);
  const [caisses, setCaisses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { currentBoutique } = useUser();

  React.useEffect(() => {
    // load caisses for autocomplete (filtered by boutique if available)
    let mounted = true;
    (async () => {
      try {
        const list = await (await import('../api/caisse')).default.listCaisses();
        if (!mounted) return;
        const filtered = (list || []).filter((c: any) => !currentBoutique?.id || c.boutiqueId === currentBoutique.id || c.boutique?.id === currentBoutique.id);
        setCaisses(filtered);
      } catch (err) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [currentBoutique]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!libelle.trim()) { Swal.fire('Erreur', 'Le libellé est requis', 'error'); return; }
    const m = parseInt(montant || '0', 10);
    if (!m || m <= 0) { Swal.fire('Erreur', 'Le montant doit être supérieur à 0', 'error'); return; }
    setLoading(true);
    try {
      const payload: any = { libelle, montant: m, note };
      if (date) payload.date = date;
      if (referenceCaisse) payload.referenceCaisse = referenceCaisse;
      const res = await createDepense(payload);
      Swal.fire('Succès', `Dépense créée (${res.reference})`, 'success');
      setLibelle(''); setMontant(''); setDate(''); setNote(''); setReferenceCaisse('');
      onCreated && onCreated(res);
    } catch (err: any) {
      Swal.fire('Erreur', err.message || 'Erreur', 'error');
    } finally { setLoading(false); }
  };

  return (
    <RequirePermission permission="DEPENSE_CREER">
      <div className="card mb-3">
        <div className="card-body">
          <h5>Créer une dépense</h5>
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-2">
                <label>Libellé</label>
                <input className="form-control" value={libelle} onChange={e => setLibelle(e.target.value)} />
              </div>
              <div className="col-md-3 mb-2">
                <label>Montant</label>
                <input className="form-control" type="number" value={montant} onChange={e => setMontant(e.target.value)} />
              </div>
              <div className="col-md-3 mb-2">
                <label>Date</label>
                <input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="col-md-8 mb-2">
                <label>Note</label>
                <input className="form-control" value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="col-md-4 mb-2">
                <label>Référence caisse (optionnel)</label>
                <SearchableSelect
                  options={caisses.map(c => ({ value: c.reference, label: `${c.reference} - ${c.numero || ''} - ${c.statut || ''}` }))}
                  value={referenceCaisse}
                  onChange={(v) => setReferenceCaisse(v as string | null)}
                  placeholder="Choisir une caisse"
                />
              </div>
            </div>
            <div className="mt-3">
              <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Envoi...' : 'Créer'}</button>
            </div>
          </form>
        </div>
      </div>
    </RequirePermission>
  );
};

export default DepenseForm;