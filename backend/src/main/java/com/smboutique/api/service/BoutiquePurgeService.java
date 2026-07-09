package com.smboutique.api.service;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.repository.BoutiqueRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Irreversibly removes a boutique and its complete business data graph.
 * Authorization is deliberately kept at the controller boundary and the
 * operation is atomic: any SQL failure rolls the whole purge back.
 */
@Service
public class BoutiquePurgeService {

    private final BoutiqueRepository boutiqueRepository;
    private final NamedParameterJdbcTemplate jdbc;

    public BoutiquePurgeService(BoutiqueRepository boutiqueRepository, NamedParameterJdbcTemplate jdbc) {
        this.boutiqueRepository = boutiqueRepository;
        this.jdbc = jdbc;
    }

    @Transactional
    public PurgeResult purge(Long boutiqueId) {
        Boutique boutique = boutiqueRepository.findById(boutiqueId)
                .orElseThrow(() -> new IllegalArgumentException("Boutique introuvable"));

        List<Long> userIds = ids("SELECT id_utilisateur FROM utilisateur WHERE boutique_id = :bid", boutiqueId);
        List<Long> magasinIds = ids("SELECT id_magasin FROM magasin WHERE id_boutique = :bid", boutiqueId);
        List<Long> productIds = jdbc.queryForList(
                """
                SELECT DISTINCT p.id_produit
                FROM tbl_product p
                LEFT JOIN unite u ON u.id_unite = p.id_unite
                LEFT JOIN stock s ON s.id_produit = p.id_produit
                WHERE (u.id_boutique = :bid OR s.id_boutique = :bid)
                  AND NOT EXISTS (
                      SELECT 1 FROM stock other_stock
                      WHERE other_stock.id_produit = p.id_produit
                        AND other_stock.id_boutique <> :bid
                  )
                """,
                new MapSqlParameterSource("bid", boutiqueId),
                Long.class
        );
        List<Long> clientIds = ids(
                "SELECT DISTINCT id_client_gr FROM commande_client WHERE id_boutique = :bid AND id_client_gr IS NOT NULL",
                boutiqueId
        );
        List<String> mediaFiles = new ArrayList<>(jdbc.queryForList(
                "SELECT product_image FROM tbl_product WHERE id_produit IN (:products) AND product_image IS NOT NULL",
                new MapSqlParameterSource("products", nonEmpty(productIds)),
                String.class
        ));
        if (boutique.getLogo() != null && !boutique.getLogo().isBlank()) {
            mediaFiles.add(boutique.getLogo());
        }

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("bid", boutiqueId)
                .addValue("users", nonEmpty(userIds))
                .addValue("magasins", nonEmpty(magasinIds))
                .addValue("products", nonEmpty(productIds))
                .addValue("clients", nonEmpty(clientIds));
        Map<String, Integer> deleted = new LinkedHashMap<>();

        // Audit/movement rows reference most transactional children and must go first.
        remove(deleted, "mouvements", """
                DELETE FROM mouvement
                WHERE id_boutique = :bid
                   OR id_utilisateur IN (:users)
                   OR id_magasin IN (:magasins)
                   OR id_produit IN (:products)
                   OR id_stock IN (SELECT id_stock FROM stock WHERE id_boutique = :bid)
                   OR id_ligne_vente IN (
                       SELECT lv.id_ligne_vente FROM ligne_vente lv
                       JOIN vente v ON v.id_vente = lv.id_vente WHERE v.id_boutique = :bid
                   )
                   OR id_ligne_reception IN (
                       SELECT lr.id_ligne_re FROM ligne_reception lr
                       JOIN reception r ON r.id_reception = lr.id_reception WHERE r.id_boutique = :bid
                   )
                   OR id_ligne_livraison IN (
                       SELECT ll.id_ligne_livraison FROM ligne_livraison ll
                       JOIN livraison l ON l.id_livraison = ll.id_livraison
                       JOIN commande_client c ON c.id_cmd_client = l.id_commande_client
                       WHERE c.id_boutique = :bid
                   )
                """, params);

        remove(deleted, "notifications", "DELETE FROM notification WHERE boutique_id = :bid OR user_id IN (:users)", params);
        remove(deleted, "caisse_movements", "DELETE FROM caisse_movement WHERE boutique_id = :bid OR user_id IN (:users)", params);
        remove(deleted, "caisse_transactions", "DELETE FROM caisse_transaction WHERE boutique_id = :bid OR user_id IN (:users)", params);
        remove(deleted, "depenses", "DELETE FROM depense WHERE boutique_id = :bid", params);
        remove(deleted, "utilisations_pertes", "DELETE FROM utilisation_pertes WHERE id_boutique = :bid OR id_magasin IN (:magasins) OR id_article IN (:products)", params);

        remove(deleted, "lignes_livraison", """
                DELETE FROM ligne_livraison WHERE id_livraison IN (
                    SELECT l.id_livraison FROM livraison l
                    JOIN commande_client c ON c.id_cmd_client = l.id_commande_client
                    WHERE c.id_boutique = :bid
                ) OR id_produit IN (:products)
                """, params);
        remove(deleted, "livraisons", """
                DELETE FROM livraison WHERE id_commande_client IN (
                    SELECT id_cmd_client FROM commande_client WHERE id_boutique = :bid
                )
                """, params);
        remove(deleted, "paiements_clients", """
                DELETE FROM paiement_client WHERE id_comnd_client IN (
                    SELECT id_cmd_client FROM commande_client WHERE id_boutique = :bid
                )
                """, params);
        remove(deleted, "lignes_commandes_clients", """
                DELETE FROM ligne_commande_client
                WHERE id_cmd_client IN (SELECT id_cmd_client FROM commande_client WHERE id_boutique = :bid)
                   OR id_produit IN (:products)
                """, params);
        remove(deleted, "commandes_clients", "DELETE FROM commande_client WHERE id_boutique = :bid", params);

        remove(deleted, "lignes_ventes", """
                DELETE FROM ligne_vente
                WHERE id_vente IN (SELECT id_vente FROM vente WHERE id_boutique = :bid)
                   OR id_produit IN (:products)
                """, params);
        remove(deleted, "ventes", "DELETE FROM vente WHERE id_boutique = :bid", params);

        remove(deleted, "lignes_receptions", """
                DELETE FROM ligne_reception
                WHERE id_reception IN (SELECT id_reception FROM reception WHERE id_boutique = :bid)
                   OR id_produit IN (:products)
                """, params);
        remove(deleted, "receptions", "DELETE FROM reception WHERE id_boutique = :bid", params);
        remove(deleted, "paiements_fournisseurs", """
                DELETE FROM paiement WHERE id_commande_fournisseur IN (
                    SELECT id_commande_fournisseur FROM commande_fournisseur WHERE id_boutique = :bid
                )
                """, params);
        remove(deleted, "lignes_commandes_fournisseurs", """
                DELETE FROM ligne_commande WHERE id_commande_fournisseur IN (
                    SELECT id_commande_fournisseur FROM commande_fournisseur WHERE id_boutique = :bid
                ) OR id_stock IN (SELECT id_stock FROM stock WHERE id_boutique = :bid)
                """, params);
        remove(deleted, "commandes_fournisseurs", "DELETE FROM commande_fournisseur WHERE id_boutique = :bid", params);

        remove(deleted, "lignes_inventaires", """
                DELETE FROM ligne_inventaire
                WHERE id_inventaire IN (SELECT id_inventaire FROM inventaire WHERE id_boutique = :bid)
                   OR id_produit IN (:products)
                """, params);
        remove(deleted, "inventaires", "DELETE FROM inventaire WHERE id_boutique = :bid", params);

        remove(deleted, "transferts", """
                DELETE FROM transfer
                WHERE id_utilisateur IN (:users)
                   OR (UPPER(source_type) = 'BOUTIQUE' AND source_id = :bid)
                   OR (UPPER(dest_type) = 'BOUTIQUE' AND dest_id = :bid)
                   OR (UPPER(source_type) = 'MAGASIN' AND source_id IN (:magasins))
                   OR (UPPER(dest_type) = 'MAGASIN' AND dest_id IN (:magasins))
                """, params);
        remove(deleted, "stocks", "DELETE FROM stock WHERE id_boutique = :bid OR id_magasin IN (:magasins) OR id_produit IN (:products)", params);
        remove(deleted, "produits", "DELETE FROM tbl_product WHERE id_produit IN (:products)", params);
        remove(deleted, "configurations_marges", "DELETE FROM configuration_marge WHERE id_boutique = :bid", params);
        remove(deleted, "caisses", "DELETE FROM caisse WHERE id_boutique = :bid", params);
        remove(deleted, "magasins", "DELETE FROM magasin WHERE id_boutique = :bid", params);
        remove(deleted, "fournisseurs", "DELETE FROM fournisseur WHERE id_boutique = :bid", params);
        remove(deleted, "unites", """
                DELETE FROM unite u WHERE u.id_boutique = :bid
                  AND NOT EXISTS (SELECT 1 FROM tbl_product p WHERE p.id_unite = u.id_unite)
                """, params);

        remove(deleted, "paiements_abonnements", """
                DELETE FROM abonnement_paiement WHERE abonnement_id IN (
                    SELECT id FROM abonnement_boutique WHERE boutique_id = :bid
                )
                """, params);
        remove(deleted, "abonnements", "DELETE FROM abonnement_boutique WHERE boutique_id = :bid", params);

        remove(deleted, "utilisateur_permissions", "DELETE FROM utilisateur_permissions WHERE utilisateur_id IN (:users)", params);
        remove(deleted, "utilisateur_roles", "DELETE FROM utilisateur_roles WHERE utilisateur_id IN (:users)", params);
        remove(deleted, "utilisateurs", "DELETE FROM utilisateur WHERE boutique_id = :bid", params);
        remove(deleted, "clients_orphelins", """
                DELETE FROM client_grossiste c
                WHERE c.id_client_gr IN (:clients)
                  AND NOT EXISTS (SELECT 1 FROM commande_client cc WHERE cc.id_client_gr = c.id_client_gr)
                """, params);
        remove(deleted, "boutiques", "DELETE FROM boutique WHERE id_boutique = :bid", params);

        deleteMediaAfterCommit(mediaFiles);
        int total = deleted.values().stream().mapToInt(Integer::intValue).sum();
        return new PurgeResult(boutique.getId(), boutique.getNom(), total, deleted);
    }

    private List<Long> ids(String sql, Long boutiqueId) {
        return jdbc.queryForList(sql, new MapSqlParameterSource("bid", boutiqueId), Long.class);
    }

    private List<Long> nonEmpty(List<Long> ids) {
        return ids == null || ids.isEmpty() ? List.of(-1L) : ids;
    }

    private void remove(Map<String, Integer> deleted, String key, String sql, MapSqlParameterSource params) {
        deleted.put(key, jdbc.update(sql, params));
    }

    private void deleteMediaAfterCommit(List<String> mediaFiles) {
        if (mediaFiles == null || mediaFiles.isEmpty()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                Path uploadRoot = Paths.get("uploads").toAbsolutePath().normalize();
                for (String value : mediaFiles) {
                    try {
                        if (value == null || value.isBlank()) continue;
                        String relative = value.replace('\\', '/').replaceFirst("^/+", "");
                        if (relative.startsWith("uploads/")) relative = relative.substring("uploads/".length());
                        Path target = uploadRoot.resolve(relative).normalize();
                        if (target.startsWith(uploadRoot)) Files.deleteIfExists(target);
                    } catch (Exception ignored) {
                        // Database deletion has committed; an orphaned file must not
                        // turn a successful business purge into a false failure.
                    }
                }
            }
        });
    }

    public record PurgeResult(
            Long boutiqueId,
            String boutiqueNom,
            int totalDeleted,
            Map<String, Integer> deleted
    ) {}
}
