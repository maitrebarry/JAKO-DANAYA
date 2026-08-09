package com.smboutique.api.service;

import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.UtilisateurRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Irreversibly removes a single user and its complete business data graph
 * (ventes, commandes, réceptions, livraisons, inventaires, transferts,
 * mouvements, caisse, notifications, rôles/permissions).
 *
 * ATTENTION : opération destructive. Supprimer les ventes/réceptions n'ajuste PAS
 * le stock ni la caisse : les totaux de la boutique deviennent incohérents. À
 * réserver au SuperAdmin, avec confirmation explicite côté appelant.
 *
 * L'opération est atomique : toute erreur SQL annule l'ensemble.
 */
@Service
public class UserPurgeService {

    private final UtilisateurRepository utilisateurRepository;
    private final NamedParameterJdbcTemplate jdbc;

    public UserPurgeService(UtilisateurRepository utilisateurRepository, NamedParameterJdbcTemplate jdbc) {
        this.utilisateurRepository = utilisateurRepository;
        this.jdbc = jdbc;
    }

    @Transactional
    public PurgeResult purge(Long userId) {
        Utilisateur user = utilisateurRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        MapSqlParameterSource p = new MapSqlParameterSource().addValue("uid", userId);
        Map<String, Integer> deleted = new LinkedHashMap<>();

        // Sous-requêtes réutilisées (commandes du user)
        final String userCC = "SELECT id_cmd_client FROM commande_client WHERE id_utilisateur = :uid";
        final String userCF = "SELECT id_commande_fournisseur FROM commande_fournisseur WHERE id_utilisateur = :uid";

        // 1) Mouvements (audit) : référencent les lignes de vente/réception/livraison,
        //    les transferts et inventaires — doivent partir en premier.
        remove(deleted, "mouvements", """
                DELETE FROM mouvement WHERE
                    id_utilisateur = :uid
                    OR id_ligne_vente IN (
                        SELECT lv.id_ligne_vente FROM ligne_vente lv
                        JOIN vente v ON v.id_vente = lv.id_vente WHERE v.id_utilisateur = :uid)
                    OR id_ligne_reception IN (
                        SELECT lr.id_ligne_re FROM ligne_reception lr
                        JOIN reception r ON r.id_reception = lr.id_reception
                        WHERE r.id_commande_fournisseur IN (""" + userCF + """
                        ))
                    OR id_ligne_livraison IN (
                        SELECT ll.id_ligne_livraison FROM ligne_livraison ll
                        JOIN livraison l ON l.id_livraison = ll.id_livraison
                        WHERE l.id_commande_client IN (""" + userCC + """
                        ))
                    OR id_transfer IN (SELECT id_transfer FROM transfer WHERE id_utilisateur = :uid)
                    OR id_inventaire IN (SELECT id_inventaire FROM inventaire WHERE id_utilisateur = :uid)
                """, p);

        // 2) Caisse & notifications (colonne user_id)
        remove(deleted, "caisse_movements", "DELETE FROM caisse_movement WHERE user_id = :uid", p);
        remove(deleted, "caisse_transactions", "DELETE FROM caisse_transaction WHERE user_id = :uid", p);
        remove(deleted, "notifications", "DELETE FROM notification WHERE user_id = :uid", p);

        // 3) Chaîne commandes clients
        remove(deleted, "lignes_livraison",
                "DELETE FROM ligne_livraison WHERE id_livraison IN (" +
                        "SELECT id_livraison FROM livraison WHERE id_commande_client IN (" + userCC + "))", p);
        remove(deleted, "livraisons",
                "DELETE FROM livraison WHERE id_commande_client IN (" + userCC + ")", p);
        remove(deleted, "paiements_clients",
                "DELETE FROM paiement_client WHERE id_comnd_client IN (" + userCC + ")", p);
        remove(deleted, "lignes_commandes_clients",
                "DELETE FROM ligne_commande_client WHERE id_cmd_client IN (" + userCC + ")", p);
        remove(deleted, "commandes_clients", "DELETE FROM commande_client WHERE id_utilisateur = :uid", p);

        // 4) Ventes
        remove(deleted, "lignes_ventes",
                "DELETE FROM ligne_vente WHERE id_vente IN (SELECT id_vente FROM vente WHERE id_utilisateur = :uid)", p);
        remove(deleted, "ventes", "DELETE FROM vente WHERE id_utilisateur = :uid", p);

        // 5) Chaîne commandes fournisseurs
        remove(deleted, "lignes_receptions",
                "DELETE FROM ligne_reception WHERE id_reception IN (" +
                        "SELECT id_reception FROM reception WHERE id_commande_fournisseur IN (" + userCF + "))", p);
        remove(deleted, "receptions",
                "DELETE FROM reception WHERE id_commande_fournisseur IN (" + userCF + ")", p);
        remove(deleted, "paiements_fournisseurs",
                "DELETE FROM paiement WHERE id_commande_fournisseur IN (" + userCF + ")", p);
        remove(deleted, "lignes_commandes_fournisseurs",
                "DELETE FROM ligne_commande WHERE id_commande_fournisseur IN (" + userCF + ")", p);
        remove(deleted, "commandes_fournisseurs", "DELETE FROM commande_fournisseur WHERE id_utilisateur = :uid", p);

        // 6) Inventaires
        remove(deleted, "lignes_inventaires",
                "DELETE FROM ligne_inventaire WHERE id_inventaire IN (" +
                        "SELECT id_inventaire FROM inventaire WHERE id_utilisateur = :uid)", p);
        remove(deleted, "inventaires", "DELETE FROM inventaire WHERE id_utilisateur = :uid", p);

        // 7) Transferts
        remove(deleted, "transferts", "DELETE FROM transfer WHERE id_utilisateur = :uid", p);

        // 8) Comptes créés par ce user : on rompt le lien (on ne supprime pas ces comptes).
        remove(deleted, "createur_delie", "UPDATE utilisateur SET id_createur = NULL WHERE id_createur = :uid", p);

        // 9) Rôles / permissions du user
        remove(deleted, "utilisateur_permissions", "DELETE FROM utilisateur_permissions WHERE utilisateur_id = :uid", p);
        remove(deleted, "utilisateur_roles", "DELETE FROM utilisateur_roles WHERE utilisateur_id = :uid", p);

        // 10) Le user lui-même
        remove(deleted, "utilisateur", "DELETE FROM utilisateur WHERE id_utilisateur = :uid", p);

        int total = deleted.values().stream().mapToInt(Integer::intValue).sum();
        return new PurgeResult(user.getId(), user.getNom(), user.getEmail(), total, deleted);
    }

    private void remove(Map<String, Integer> deleted, String key, String sql, MapSqlParameterSource params) {
        deleted.put(key, jdbc.update(sql, params));
    }

    public record PurgeResult(
            Long userId,
            String nom,
            String email,
            int totalDeleted,
            Map<String, Integer> deleted
    ) {}
}
