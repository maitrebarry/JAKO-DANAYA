import React from 'react';

const CONTACT_EMAIL = 'barrymoustapha908@gmail.com';
const LAST_UPDATED = '3 juillet 2026';

const PrivacyPolicy: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6f9', padding: '24px 0' }}>
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="card shadow-sm">
          <div className="card-body p-4 p-md-5">
            <h1 className="h3 mb-1">Politique de confidentialité — JÀGO DÁNAYA</h1>
            <p className="text-muted mb-4">Dernière mise à jour : {LAST_UPDATED}</p>

            <p>
              JÀGO DÁNAYA (« l'application », « le Service ») est une application de gestion de boutique
              (produits, stocks, achats, ventes, caisse, dépenses et abonnement), disponible en version web
              et en version mobile (Android/iOS). Cette politique explique quelles données sont collectées,
              pourquoi, et comment elles sont utilisées et protégées.
            </p>

            <h2 className="h5 mt-4">1. Responsable du traitement</h2>
            <p>
              JÀGO DÁNAYA est édité et exploité par son développeur/gestionnaire, joignable à l'adresse :{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>

            <h2 className="h5 mt-4">2. Données que nous collectons</h2>
            <p>Selon votre usage de l'application, nous pouvons collecter :</p>
            <ul>
              <li>
                <strong>Données de compte</strong> : nom, prénom, adresse e-mail, numéro de téléphone,
                mot de passe (stocké de façon chiffrée/hachée, jamais en clair), rôle et permissions au sein
                de votre boutique.
              </li>
              <li>
                <strong>Connexion via Google</strong> : si vous choisissez de vous connecter avec Google,
                nous recevons votre nom et votre adresse e-mail associés à votre compte Google, via le
                protocole standard OAuth2. Nous ne recevons jamais votre mot de passe Google.
              </li>
              <li>
                <strong>Données professionnelles / boutique</strong> : informations sur votre boutique
                (nom, adresse, pays), vos produits, fournisseurs, clients, stocks, commandes, ventes,
                mouvements de caisse et dépenses, saisis par vous ou votre équipe dans le cadre de la
                gestion de votre commerce.
              </li>
              <li>
                <strong>Preuves de paiement d'abonnement</strong> : lorsque vous soumettez un règlement
                d'abonnement (Orange Money, Wave, MobiCash/Moov), vous pouvez téléverser une photo ou capture
                du reçu/message de transfert, ainsi qu'une référence de transaction, afin que nous puissions
                valider votre paiement manuellement.
              </li>
              <li>
                <strong>Accès à la caméra (version mobile)</strong> : l'application demande la permission
                d'accéder à la caméra de votre appareil uniquement pour scanner des codes-barres produits et,
                si besoin, capturer une preuve de paiement. Aucune photo n'est enregistrée ou transmise à
                notre insu ; les images ne sont utilisées que pour l'action que vous initiez explicitement
                (scan ou envoi d'un justificatif).
              </li>
              <li>
                <strong>Données techniques</strong> : journal des actions effectuées dans l'application
                (mouvements, connexions) à des fins de traçabilité et d'audit interne à votre boutique,
                adresse IP et informations d'appareil de façon limitée, à des fins de sécurité.
              </li>
            </ul>

            <h2 className="h5 mt-4">3. Pourquoi nous utilisons ces données</h2>
            <ul>
              <li>Fournir et faire fonctionner les fonctionnalités de gestion de boutique (produits, stocks, ventes, achats, caisse, dépenses, rapports) ;</li>
              <li>Authentifier les utilisateurs et sécuriser l'accès à votre compte et à votre boutique ;</li>
              <li>Gérer votre abonnement au service et valider vos paiements ;</li>
              <li>Assurer la traçabilité des opérations (historique, mouvements) pour la sécurité et l'audit de votre activité ;</li>
              <li>Vous contacter en cas de besoin lié à votre compte ou à votre abonnement ;</li>
              <li>Améliorer et corriger le Service.</li>
            </ul>

            <h2 className="h5 mt-4">4. Partage des données</h2>
            <p>
              Nous ne vendons pas vos données. Elles ne sont partagées qu'avec :
            </p>
            <ul>
              <li>Notre hébergeur technique (Render), qui héberge le serveur et la base de données de l'application ;</li>
              <li>Les autres membres autorisés de votre boutique (selon leur rôle et leurs permissions), dans le cadre normal d'utilisation collaborative de l'outil ;</li>
              <li>Les autorités compétentes, uniquement si la loi nous y oblige.</li>
            </ul>

            <h2 className="h5 mt-4">5. Conservation des données</h2>
            <p>
              Vos données sont conservées tant que votre compte est actif. Vous pouvez demander la
              suppression de votre compte et des données associées en nous contactant à l'adresse ci-dessus ;
              nous procéderons à la suppression, sous réserve des données que nous devons conserver pour des
              raisons légales ou comptables (ex. historique de paiements).
            </p>

            <h2 className="h5 mt-4">6. Sécurité</h2>
            <p>
              L'accès à l'application se fait via une connexion chiffrée (HTTPS). Les mots de passe sont
              stockés sous forme hachée. L'accès aux données de votre boutique est restreint par un système
              de rôles et de permissions.
            </p>

            <h2 className="h5 mt-4">7. Vos droits</h2>
            <p>
              Vous pouvez à tout moment demander l'accès, la correction ou la suppression de vos données
              personnelles en nous contactant à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>

            <h2 className="h5 mt-4">8. Mineurs</h2>
            <p>
              JÀGO DÁNAYA est un outil professionnel de gestion commerciale et n'est pas destiné aux
              enfants. Nous ne collectons pas sciemment de données concernant des mineurs.
            </p>

            <h2 className="h5 mt-4">9. Modifications de cette politique</h2>
            <p>
              Cette politique peut être mise à jour pour refléter des évolutions du Service ou de la
              réglementation. La date de dernière mise à jour est indiquée en haut de cette page.
            </p>

            <h2 className="h5 mt-4">10. Contact</h2>
            <p>
              Pour toute question relative à cette politique ou à vos données, contactez-nous à :{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
