package com.smboutique.api.config;

import com.smboutique.api.model.*;
import com.smboutique.api.repository.BoutiqueRepository;
import com.smboutique.api.repository.PermissionRepository;
import com.smboutique.api.repository.RoleRepository;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.repository.MagasinRepository;
import com.smboutique.api.repository.ProduitRepository;
import com.smboutique.api.repository.StockRepository;
import com.smboutique.api.repository.UniteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataInitializer.class);

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private BoutiqueRepository boutiqueRepository;

    @Autowired
    private MagasinRepository magasinRepository;

    @Autowired
    private ProduitRepository produitRepository;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private UniteRepository uniteRepository;

    @Autowired
    private com.smboutique.api.repository.PaysRepository paysRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private com.smboutique.api.repository.VenteRepository venteRepository;

    @Value("${app.reset-db:false}")
    private boolean resetDb;

    @Override
    public void run(String... args) throws Exception {
        logger.info("Starting data initialization...");
        if (resetDb) {
            resetDatabase();
        }
        initializePermissions();
        initializeRoles();
        initializePays();
        initializeBoutique();
        initializeSuperAdmin();
        backfillVenteBoutique();
        logger.info("Seeding pays assignments done.");
//        initializeTestData();
        logger.info("Data initialization completed.");
    }

    private void backfillVenteBoutique() {
        try {
            long total = venteRepository.count();
            if (total == 0) {
                logger.info("No ventes present, skipping backfillVenteBoutique.");
                return;
            }
            Boutique boutique = boutiqueRepository.findAll().get(0);
            long updated = 0;
            for (Vente v : venteRepository.findAll()) {
                if (v.getBoutique() == null) {
                    v.setBoutique(boutique);
                    venteRepository.save(v);
                    updated++;
                }
            }
            logger.info("Backfilled {} ventes with default boutique (id={}).", updated, boutique.getId());
        } catch (Exception e) {
            logger.warn("backfillVenteBoutique failed: {}", e.getMessage());
        }
    }

    private void resetDatabase() {
        logger.warn("app.reset-db=true -> Resetting database content (deleting all rows)...");
        try {
            // Delete in FK-safe order: users -> roles -> permissions -> boutiques -> pays
            utilisateurRepository.deleteAll();
            roleRepository.deleteAll();
            permissionRepository.deleteAll();
            boutiqueRepository.deleteAll();
            paysRepository.deleteAll();
            logger.warn("Database reset done. Tables will be re-seeded.");
        } catch (Exception ex) {
            logger.error("Error while resetting database: {}", ex.getMessage(), ex);
        }
    }

    private void initializePermissions() {
        logger.info("Initializing permissions...");

        // Liste complète des permissions (menu sidebar + fonctionnalités futures)
        String[][] permissions = {
            // Dashboard
            {"TABLEAU_DE_BORD_LECTURE", "Permission pour lire le tableau de bord"},
            {"TABLEAU_DE_BORD_VOIR", "Permission pour voir le tableau de bord"},

            // Utilisateurs
            {"UTILISATEUR_GERER", "Permission pour gérer les utilisateurs"},
            {"UTILISATEUR_LECTURE", "Permission pour lire les utilisateurs"},
            {"UTILISATEUR_CREER", "Permission pour créer des utilisateurs"},
            {"UTILISATEUR_MODIFIER", "Permission pour modifier des utilisateurs"},
            {"UTILISATEUR_SUPPRIMER", "Permission pour supprimer des utilisateurs"},
            {"UTILISATEUR_ACTIVER_DESACTIVER", "Permission pour activer ou désactiver des utilisateurs"},

            // Produits
            {"PRODUIT_LECTURE", "Permission pour lire les produits"},
            {"PRODUIT_CREER", "Permission pour créer des produits"},
            {"PRODUIT_MODIFIER", "Permission pour modifier des produits"},
            {"PRODUIT_SUPPRIMER", "Permission pour supprimer des produits"},
            {"PRODUIT_VOIR", "Permission pour voir la section produits"},
            {"PRODUIT_MOUVEMENT", "Permission pour voir les mouvements produits"},


            // Commandes / Achats
            {"COMMANDE_LECTURE", "Permission pour lire les commandes"},
            {"COMMANDE_CREER", "Permission pour créer des commandes"},
            {"COMMANDE_MODIFIER", "Permission pour modifier les commandes"},
            {"COMMANDE_SUPPRIMER", "Permission pour supprimer les commandes"},
            {"ACHAT_VOIR", "Permission pour voir la section achats"},
            {"ACHAT_HISTORIQUE", "Permission pour voir l'historique des achats"},

            // Clients
            {"CLIENT_LECTURE", "Permission pour lire les clients"},
            {"CLIENT_CREER", "Permission pour créer des clients"},
            {"CLIENT_MODIFIER", "Permission pour modifier des clients"},
            {"CLIENT_SUPPRIMER", "Permission pour supprimer des clients"},

            // Ventes
            {"VENTE_LECTURE", "Permission pour lire les ventes"},
            {"VENTE_CREER", "Permission pour créer des ventes"},
            {"VENTE_MODIFIER", "Permission pour modifier les ventes"},
            {"VENTE_SUPPRIMER", "Permission pour supprimer les ventes"},
            {"VENTE_ESPECE_VOIR", "Permission pour voir ventes espèces"},
            {"VENTE_CREDIT_VOIR", "Permission pour voir ventes à crédit"},
            {"VENTE_HISTORIQUE", "Permission pour voir l'historique des ventes"},
            {"VENTE_EMPLACEMENT_MODIFIER","permission pour changer l'espace de vente commande"},

            // Inventaire
            {"INVENTAIRE_LECTURE", "Permission pour lire l'inventaire"},
            {"INVENTAIRE_CREER", "Permission pour créer des éléments d'inventaire"},
            {"INVENTAIRE_MODIFIER", "Permission pour modifier l'inventaire"},
            {"INVENTAIRE_REGULARISER", "Permission pour régulariser un inventaire"},
            {"INVENTAIRE_SUPPRIMER", "Permission pour supprimer des éléments d'inventaire"},
            {"INVENTAIRE_VOIR", "Permission pour voir la section inventaire"},
            {"INVENTAIRE_MOUVEMENT", "Permission pour voir mouvements d'inventaire"},


            // Utilisations / Pertes (nouveau découpage)
            {"UTILISA_PERTE_VOIR", "Permission pour voir les utilisations/pertes"},
            {"UTILISA_PERTE_CREER", "Permission pour créer des utilisations/pertes"},
            {"UTILISA_PERTE_MODIFIER", "Permission pour modifier des utilisations/pertes"},
            {"UTILISA_PERTE_SUPPRIMER", "Permission pour supprimer des utilisations/pertes"},
            // unite
                {"UNITE_CREER","Permission pour creer une unite"},
            // Fournisseurs
            {"FOURNISSEUR_LECTURE", "Permission pour lire les fournisseurs"},
            {"FOURNISSEUR_CREER", "Permission pour créer des fournisseurs"},
            {"FOURNISSEUR_MODIFIER", "Permission pour modifier les fournisseurs"},
            {"FOURNISSEUR_SUPPRIMER", "Permission pour supprimer les fournisseurs"},
            {"FOURNISSEUR_VOIR", "Permission pour voir la section fournisseurs"},

            // Boutiques
            {"BOUTIQUE_LECTURE", "Permission pour lire les boutiques"},
            {"BOUTIQUE_CREER", "Permission pour créer des boutiques"},
            {"BOUTIQUE_MODIFIER", "Permission pour modifier les boutiques"},
            {"BOUTIQUE_SUPPRIMER", "Permission pour supprimer les boutiques"},

            // Rapports
            {"RAPPORT_LECTURE", "Permission pour lire les rapports"},
            {"RAPPORT_CREER", "Permission pour créer des rapports"},

            // Documents
            {"DOCUMENTS_VOIR", "Permission pour voir les documents"},
            {"DOCUMENTS_TELECHARGER", "Permission pour télécharger les documents"},

            // Paramètres / Configuration
//            {"PARAMETRES_LECTURE", "Permission pour lire les paramètres"},
//            {"PARAMETRES_MODIFIER", "Permission pour modifier les paramètres"},
//            {"CONFIGURATION_VOIR", "Permission pour voir la configuration"},

            // Configuration marges
            {"CONFIG_MARGE_LECTURE", "Permission pour lire la configuration des marges"},
            {"CONFIG_MARGE_ECRITURE", "Permission pour créer/modifier la configuration des marges"},
            {"CONFIG_MARGE_SUPPRESSION", "Permission pour supprimer la configuration des marges"},
            {"CONFIGURATION_VOIR", "permission pour voir le menu configuration"},
            // Paiements / Réceptions / Livraisons
            {"PAIEMENT_CREER", "Permission pour créer paiements"},
            {"PAIEMENT_MODIFIER", "Permission pour modifier paiements"},
            {"PAIEMENT_SUPPRESSION", "Permission pour supprimer paiements"},
            {"PAIEMENT_ANNULATION", "Permission pour annuler paiements"},
            {"RECEPTION_CREER", "Permission pour créer receptions"},
            {"RECEPTION_MODIFIER", "Permission pour modifier receptions"},
            {"RECEPTION_SUPPRESSION", "Permission pour supprimer receptions"},
            {"RECEPTION_ANNULATION", "Permission pour annuler receptions"},
            {"LIVRAISON_ECRITURE", "Permission pour gérer livraisons"},

            // Caisse / Dépenses
            {"CAISSE_LECTURE", "Permission pour lire la caisse"},
            {"CAISSE_VOIR", "Permission pour voir la caisse"},
            {"CAISSE_GERER", "Permission pour gérer la caisse"},
            {"CAISSE_MOUVEMENT_VIEW", "Permission de voir les mouvements de la caisse"},
            {"MOUVEMENT_AUDIT", "Permission pour voir toutes les actions système (audit)"},

            // Dépenses feature permissions
            {"DEPENSE_CREER", "Permission pour créer des dépenses"},
            {"DEPENSE_LECTURE", "Permission pour lire les dépenses"},
            {"DEPENSE_VALIDATION", "Permission pour valider/rejeter des dépenses"},
            {"DEPENSE_ANNULATION", "Permission pour annuler des dépenses"},
//            {"DEPENSE_VOIR", "Permission pour voir les dépenses"},
            // Transferts
            {"TRANSFERT_VOIR", "Permission pour voir l'interface de transfert"},
            {"TRANSFERT_LECTURE", "Permission pour lire les transferts"},
            {"TRANSFERT_CREER", "Permission pour créer/exécuter des transferts"},
            {"TRANSFERT_MODIFIER", "Permission pour modifier des transferts"},
            {"TRANSFERT_SUPPRIMER", "Permission pour supprimer des transferts"}        };

        int created = 0;
        for (String[] perm : permissions) {
            String name = perm[0];
            String desc = perm[1];
            if (permissionRepository.findByName(name).isEmpty()) {
                Permission permission = new Permission();
                permission.setName(name);
                permission.setDescription(desc);
                permissionRepository.save(permission);
                created++;
            }
        }
        logger.info("Permissions ensured, created {} new permissions", created);
    }

    private void initializePays() {
        logger.info("Initializing pays...");
        if (paysRepository.count() == 0) {
            Pays mali = new Pays(); mali.setCodeIso("ML"); mali.setNom("Mali"); mali.setIndicatif("+223"); mali.setDeviseCode("XOF"); mali.setDeviseSymbole("FCFA"); mali.setDrapeau("🇲🇱"); paysRepository.save(mali);
            Pays guinee = new Pays(); guinee.setCodeIso("GN"); guinee.setNom("Guinée"); guinee.setIndicatif("+224"); guinee.setDeviseCode("GNF"); guinee.setDeviseSymbole("GNF"); guinee.setDrapeau("🇬🇳"); paysRepository.save(guinee);
            Pays senegal = new Pays(); senegal.setCodeIso("SN"); senegal.setNom("Sénégal"); senegal.setIndicatif("+221"); senegal.setDeviseCode("XOF"); senegal.setDeviseSymbole("FCFA"); senegal.setDrapeau("🇸🇳"); paysRepository.save(senegal);
            // Ghana (symbole ₵) - utile pour tests et boutiques utilisant GHS
            Pays ghana = new Pays(); ghana.setCodeIso("GH"); ghana.setNom("Ghana"); ghana.setIndicatif("+233"); ghana.setDeviseCode("GHS"); ghana.setDeviseSymbole("₵"); ghana.setDrapeau("🇬🇭"); paysRepository.save(ghana);
            logger.info("Seeded pays: ML, GN, SN");
        } else {
            logger.info("Pays already seeded, skipping");
        }
    }

    private void initializeRoles() {
        logger.info("Initializing roles...");
        if (roleRepository.count() == 0) {
            // Rôles prédéfinis
            createRole("SUPERADMIN", "Administrateur principal du système", new String[]{
                "TABLEAU_DE_BORD_LECTURE", "UTILISATEUR_GERER", "UTILISATEUR_LECTURE", "UTILISATEUR_CREER", "UTILISATEUR_MODIFIER", "UTILISATEUR_SUPPRIMER",
                "PRODUIT_LECTURE", "PRODUIT_CREER", "PRODUIT_MODIFIER", "PRODUIT_SUPPRIMER",
                "COMMANDE_LECTURE", "COMMANDE_CREER", "COMMANDE_MODIFIER", "COMMANDE_SUPPRIMER",
                "CLIENT_LECTURE", "CLIENT_CREER", "CLIENT_MODIFIER", "CLIENT_SUPPRIMER",
                "VENTE_LECTURE", "VENTE_CREER", "VENTE_MODIFIER", "VENTE_SUPPRIMER",
                "INVENTAIRE_LECTURE", "INVENTAIRE_CREER", "INVENTAIRE_MODIFIER", "INVENTAIRE_SUPPRIMER",
                "FOURNISSEUR_LECTURE", "FOURNISSEUR_CREER", "FOURNISSEUR_MODIFIER", "FOURNISSEUR_SUPPRIMER",
                "BOUTIQUE_LECTURE", "BOUTIQUE_CREER", "BOUTIQUE_MODIFIER", "BOUTIQUE_SUPPRIMER",
                "RAPPORT_LECTURE", "RAPPORT_CREER", "PARAMETRES_LECTURE", "PARAMETRES_MODIFIER","CONFIG_MARGE_SUPPRESSION",
            });

            createRole("ADMIN", "Administrateur de boutique", new String[]{
                "TABLEAU_DE_BORD_LECTURE", "UTILISATEUR_LECTURE", "UTILISATEUR_GERER", "UTILISATEUR_ACTIVER_DESACTIVER",
                "PRODUIT_LECTURE", "PRODUIT_CREER", "PRODUIT_MODIFIER", "PRODUIT_SUPPRIMER",
                "COMMANDE_LECTURE", "COMMANDE_CREER", "COMMANDE_MODIFIER", "COMMANDE_SUPPRIMER",
                "CLIENT_LECTURE", "CLIENT_CREER", "CLIENT_MODIFIER", "CLIENT_SUPPRIMER",
                "VENTE_LECTURE", "VENTE_CREER", "VENTE_MODIFIER", "VENTE_SUPPRIMER",
                "INVENTAIRE_LECTURE", "INVENTAIRE_CREER", "INVENTAIRE_MODIFIER", "INVENTAIRE_REGULARISER", "INVENTAIRE_SUPPRIMER",
                "FOURNISSEUR_LECTURE", "FOURNISSEUR_CREER", "FOURNISSEUR_MODIFIER", "FOURNISSEUR_SUPPRIMER",
                "RAPPORT_LECTURE", "RAPPORT_CREER", "DOCUMENTS_VOIR", "DOCUMENTS_TELECHARGER",
                // Transferts
                "TRANSFERT_VOIR", "TRANSFERT_LECTURE", "TRANSFERT_CREER",
                // Dépenses
                "DEPENSE_CREER", "DEPENSE_LECTURE", "DEPENSE_VALIDATION", "DEPENSE_ANNULATION"
            });

            createRole("MANAGER", "Manager de boutique", new String[]{
                "TABLEAU_DE_BORD_LECTURE", "UTILISATEUR_GERER", "UTILISATEUR_ACTIVER_DESACTIVER",
                "PRODUIT_LECTURE", "PRODUIT_CREER", "PRODUIT_MODIFIER",
                "COMMANDE_LECTURE", "COMMANDE_CREER", "COMMANDE_MODIFIER",
                "CLIENT_LECTURE", "CLIENT_CREER", "CLIENT_MODIFIER",
                "VENTE_LECTURE", "VENTE_CREER", "VENTE_MODIFIER",
                "INVENTAIRE_LECTURE", "INVENTAIRE_MODIFIER", "INVENTAIRE_REGULARISER",
                "FOURNISSEUR_LECTURE", "DOCUMENTS_VOIR"
            });

            createRole("STOREKEEPER", "Magasinier", new String[]{
                "TABLEAU_DE_BORD_LECTURE",
                "PRODUIT_LECTURE", "PRODUIT_MODIFIER",
                "INVENTAIRE_LECTURE", "INVENTAIRE_MODIFIER",
                "FOURNISSEUR_LECTURE",
                // Transferts
                "TRANSFERT_VOIR", "TRANSFERT_LECTURE", "TRANSFERT_CREER"
            });

            createRole("CASHIER", "Caissier", new String[]{
                "TABLEAU_DE_BORD_LECTURE",
                "PRODUIT_LECTURE",
                "COMMANDE_LECTURE", "COMMANDE_CREER", "COMMANDE_MODIFIER",
                "CLIENT_LECTURE",
                "VENTE_LECTURE", "VENTE_CREER",
                // Caissier can create and view dépenses
                "DEPENSE_CREER", "DEPENSE_LECTURE"
            });
            logger.info("Created 5 roles with permissions");

            // Ensure SUPERADMIN has all permissions (also handle cases where new permissions are added later)
            roleRepository.findByName("SUPERADMIN").ifPresent(superAdminRole -> {
                Set<Permission> allPerms = new HashSet<>(permissionRepository.findAll());
                superAdminRole.setPermissions(allPerms);
                roleRepository.save(superAdminRole);
                logger.info("Assigned {} permissions to SUPERADMIN role", allPerms.size());
            });
        } else {
            logger.info("Roles already exist, skipping initialization");

            // Ensure SUPERADMIN has all permissions in case new permissions have been added since last run
            roleRepository.findByName("SUPERADMIN").ifPresent(superAdminRole -> {
                Set<Permission> allPerms = new HashSet<>(permissionRepository.findAll());
                if (!superAdminRole.getPermissions().containsAll(allPerms) || superAdminRole.getPermissions().size() != allPerms.size()) {
                    superAdminRole.setPermissions(allPerms);
                    roleRepository.save(superAdminRole);
                    logger.info("Updated SUPERADMIN role to include all {} permissions", allPerms.size());
                } else {
                    logger.info("SUPERADMIN role already contains all permissions");
                }
            });

            // If roles already exist, ensure ADMIN and MANAGER include the new UTILISATEUR_ACTIVER_DESACTIVER permission
            permissionRepository.findByName("UTILISATEUR_ACTIVER_DESACTIVER").ifPresent(actPerm -> {
                roleRepository.findByName("ADMIN").ifPresent(adminRole -> {
                    if (!adminRole.getPermissions().contains(actPerm)) {
                        adminRole.getPermissions().add(actPerm);
                        roleRepository.save(adminRole);
                        logger.info("Added UTILISATEUR_ACTIVER_DESACTIVER to ADMIN role");
                    }
                });
                roleRepository.findByName("MANAGER").ifPresent(managerRole -> {
                    if (!managerRole.getPermissions().contains(actPerm)) {
                        managerRole.getPermissions().add(actPerm);
                        roleRepository.save(managerRole);
                        logger.info("Added UTILISATEUR_ACTIVER_DESACTIVER to MANAGER role");
                    }
                });
            });

            // Ensure DOCUMENTS permissions are assigned to appropriate roles when roles already exist
            permissionRepository.findByName("DOCUMENTS_VOIR").ifPresent(docViewPerm -> {
                roleRepository.findByName("ADMIN").ifPresent(adminRole -> {
                    if (!adminRole.getPermissions().contains(docViewPerm)) {
                        adminRole.getPermissions().add(docViewPerm);
                        roleRepository.save(adminRole);
                        logger.info("Added DOCUMENTS_VOIR to ADMIN role");
                    }
                });
                roleRepository.findByName("MANAGER").ifPresent(managerRole -> {
                    if (!managerRole.getPermissions().contains(docViewPerm)) {
                        managerRole.getPermissions().add(docViewPerm);
                        roleRepository.save(managerRole);
                        logger.info("Added DOCUMENTS_VOIR to MANAGER role");
                    }
                });
            });

            permissionRepository.findByName("DOCUMENTS_TELECHARGER").ifPresent(docDownloadPerm -> {
                roleRepository.findByName("ADMIN").ifPresent(adminRole -> {
                    if (!adminRole.getPermissions().contains(docDownloadPerm)) {
                        adminRole.getPermissions().add(docDownloadPerm);
                        roleRepository.save(adminRole);
                        logger.info("Added DOCUMENTS_TELECHARGER to ADMIN role");
                    }
                });
            });
        }
    }

    private void createRole(String name, String description, String[] permissionNames) {
        logger.debug("Creating role: {}", name);
        Role role = new Role();
        role.setName(name);
        role.setDescription(description);

        Set<Permission> permissions = new HashSet<>();
        Arrays.stream(permissionNames).forEach(permName -> {
            permissionRepository.findByName(permName).ifPresent(permissions::add);
        });

        role.setPermissions(permissions);
        roleRepository.save(role);
        logger.debug("Role {} created with {} permissions", name, permissions.size());
    }

    private void initializeBoutique() {
//        logger.info("Initializing boutique...");/
        if (boutiqueRepository.count() == 0) {
            Boutique boutique = new Boutique();
            boutique.setNom("COMPUTER-SERVICE-BARRY");
            boutique.setQuartier("Centre-ville");
            boutique.setAdresse("Segou");
            // set default country to ML (Mali)
            com.smboutique.api.model.Pays p = paysRepository.findByCodeIso("ML").orElse(null);
            boutique.setPays(p);
            boutiqueRepository.save(boutique);
            logger.info("Default boutique created");
        } else {
            // ensure existing boutiques have a pays (default to ML)
            if (paysRepository.findByCodeIso("ML").isPresent()) {
                com.smboutique.api.model.Pays defaultPays = paysRepository.findByCodeIso("ML").orElse(null);
                boutiqueRepository.findAll().forEach(b -> {
                    if (b.getPays() == null) {
                        b.setPays(defaultPays);
                        boutiqueRepository.save(b);
                        logger.info("Assigned default pays ML to boutique id={} name={}", b.getId(), b.getNom());
                    }
                });
            }
            logger.info("Boutique already exists, skipping initialization");
        }
    }

    private void initializeSuperAdmin() {
        logger.info("Initializing superadmin...");
        final String defaultEmail = "barrymoustapha908@gmail.com";
        Set<Permission> allPerms = new HashSet<>(permissionRepository.findAll());

        if (utilisateurRepository.findByEmailIgnoreCase(defaultEmail).isEmpty()) {
            logger.info("Superadmin not found, creating...");
            Boutique boutique = boutiqueRepository.findAll().get(0);
            logger.debug("Retrieved boutique: {}", boutique.getNom());
            
            Role superAdminRole = roleRepository.findByName("SUPERADMIN").orElseThrow();
            logger.debug("Retrieved SUPERADMIN role with {} permissions", superAdminRole.getPermissions().size());

            Utilisateur superAdmin = new Utilisateur();
            superAdmin.setNom("BARRY");
            superAdmin.setPrenom("Moustapha");
            superAdmin.setEmail(defaultEmail);
            superAdmin.setPseudo("superadmin");
            superAdmin.setMotDePasse(passwordEncoder.encode("superadmin123"));
            superAdmin.setTypeUtilisateur("SUPERADMIN");
            superAdmin.setStatut("on");
            superAdmin.setBoutique(boutique);
            superAdmin.setRoles(Set.of(superAdminRole));

            // Assign all permissions explicitly to the superadmin user so utilisateur_permissions is populated
            superAdmin.setPermissions(allPerms);

            logger.info("Saving superadmin user...");
            utilisateurRepository.save(superAdmin);
            logger.info("Superadmin user created successfully with email: {}", defaultEmail);
        } else {
            logger.info("Superadmin already exists, ensuring user has all permissions");
            utilisateurRepository.findByEmailIgnoreCase(defaultEmail).ifPresent(existing -> {
                if (existing.getPermissions() == null || !existing.getPermissions().containsAll(allPerms) || existing.getPermissions().size() != allPerms.size()) {
                    existing.setPermissions(allPerms);
                    utilisateurRepository.save(existing);
                    logger.info("Updated superadmin user to include all {} permissions", allPerms.size());
                } else {
                    logger.info("Superadmin user already has all permissions");
                }
            });
        }
    }

//    private void initializeTestData() {
//        logger.info("Initializing test data...");
//
//        try {
//            // Create unite if not exists
//            if (uniteRepository.count() == 0) {
//                Unite unite = new Unite();
//                unite.setLibelle("Pièce");
//                unite.setSymbole("pc");
//                uniteRepository.save(unite);
//                logger.info("Created unite: Pièce");
//            }
//
//            // Create magasin if not exists
//            if (magasinRepository.count() == 0) {
//                Boutique boutique = boutiqueRepository.findAll().get(0);
//                Magasin magasin = new Magasin();
//                magasin.setNom("Magasin Principal");
//                magasin.setAdresse("123 Rue du Commerce");
//                magasin.setTypeMagasin("PRINCIPAL");
//                magasin.setBoutique(boutique);
//                magasinRepository.save(magasin);
//                logger.info("Created magasin: Magasin Principal");
//            }
//
//            // Create test products and stocks
//            if (produitRepository.count() == 0) {
//                Boutique boutique = boutiqueRepository.findAll().get(0);
//                Magasin magasin = magasinRepository.findAll().get(0);
//                Unite unite = uniteRepository.findAll().get(0);
//
//                String[][] produits = {
//                    {"Riz Basmati", "500", "600", "450"},
//                    {"Huile d'olive", "1500", "1800", "1300"},
//                    {"Sucre blanc", "800", "1000", "700"},
//                    {"Café moulu", "2500", "3000", "2200"},
//                    {"Pâtes spaghetti", "600", "750", "550"}
//                };
//
//                for (String[] prod : produits) {
//                    Produit produit = new Produit();
//                    produit.setNomProduit(prod[0]);
//                    produit.setPrixEnGros(Integer.valueOf(prod[1]));
//                    produit.setPrixDetail(Integer.valueOf(prod[2]));
//                    produit.setAlerteStock(10);
//                    produit.setUnite(unite);
//                    Produit savedProduit = produitRepository.save(produit);
//
//                    // Create stock for this product
//                    Stock stock = new Stock();
//                    stock.setProduit(savedProduit);
//                    stock.setMagasin(magasin);
//                    stock.setQuantiteDisponible(50);
//                    stock.setPrixAchat(Integer.valueOf(prod[3]));
//                    stockRepository.save(stock);
//
//                    logger.info("Created product: {} with stock", prod[0]);
//                }
//            }
//        } catch (Exception e) {
//            logger.error("Error initializing test data", e);
//        }
//
//        logger.info("Test data initialization completed.");
//    }
}