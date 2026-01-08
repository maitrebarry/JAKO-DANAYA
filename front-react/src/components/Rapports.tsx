import React from 'react';
import useHasPermission from '../contexts/useHasPermission';

const Rapports: React.FC = () => {
  const canView = useHasPermission('RAPPORT_LECTURE');
  if (!canView) return <div className="alert alert-warning">Accès non autorisé</div>;
  return (
    <div>
      <div className="page-breadcrumb d-none d-sm-flex align-items-center mb-3">
        <div className="breadcrumb-title pe-3">Rapports</div>
        <div className="ps-3">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0 p-0">
              <li className="breadcrumb-item"><a href="#"><i className="bx bx-home-alt"></i></a></li>
              <li className="breadcrumb-item active" aria-current="page">Rapports</li>
            </ol>
          </nav>
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <h5>Page Rapports (prototype)</h5>
          <p>La page Rapports sera implémentée après la finalisation du module Documents. Elle permettra de définir et générer des rapports agrégés (PDF, CSV) basés sur la table `mouvement`.</p>
        </div>
      </div>
    </div>
  );
};

export default Rapports;
