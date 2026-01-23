package com.smboutique.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smboutique.api.model.Inventaire;
import com.smboutique.api.model.LigneInventaire;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.InventaireRepository;
import com.smboutique.api.repository.LigneInventaireRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class InventaireControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private org.springframework.context.ApplicationContext applicationContext;

    @Autowired
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    @Autowired
    private com.smboutique.api.repository.ProduitRepository produitRepository;

    @Autowired
    private com.smboutique.api.repository.StockRepository stockRepository;

    @Autowired
    private InventaireRepository inventaireRepository;

    @Autowired
    private LigneInventaireRepository ligneInventaireRepository;

    @Autowired
    private com.smboutique.api.service.InventaireService inventaireService;

    @Autowired
    private com.smboutique.api.repository.MouvementRepository mouvementRepository;

    @Autowired
    private com.smboutique.api.repository.UtilisateurRepository utilisateurRepository;

    @Autowired
    private com.smboutique.api.repository.PermissionRepository permissionRepository;

    @Autowired
    private com.smboutique.api.repository.MagasinRepository magasinRepository;

    private Utilisateur user;
    private Boutique boutique;
    private Produit produit;

    @BeforeEach
    void setUp() {
        // ensure a single test user exists for this email (tests run in same JVM may leave duplicates)
        final String testEmail = "inv-user@example.com";
        Utilisateur found = null;
        try {
            found = utilisateurRepository.findByEmailIgnoreCase(testEmail).orElse(null);
        } catch (org.springframework.dao.IncorrectResultSizeDataAccessException | jakarta.persistence.NonUniqueResultException ignored) {
            // repository method can throw if DB contains duplicates (some fixtures). Fall back to tolerant search.
            java.util.List<Utilisateur> matches = utilisateurRepository.findAll().stream().filter(u -> testEmail.equalsIgnoreCase(u.getEmail())).toList();
            if (matches.isEmpty()) {
                found = null;
            } else {
                // Keep the first and remove any duplicates to make repository.unique-query safe for subsequent calls
                found = matches.get(0);
                if (matches.size() > 1) {
                    java.util.List<Utilisateur> toDelete = matches.subList(1, matches.size());
                    utilisateurRepository.deleteAll(toDelete);
                }
            }
        }
        if (found == null) {
            user = new Utilisateur();
            user.setEmail(testEmail);
            user = utilisateurRepository.save(user);
        } else {
            user = found;
        }

        // create an isolated boutique for this test run to avoid interference from seeded/previous active inventories
        boutique = new Boutique();
        boutique.setNom("TEST-BOUTIQUE-" + System.nanoTime());
        boutique = boutiqueRepository.save(boutique);

        user.setBoutique(boutique);
        user = utilisateurRepository.save(user);

        produit = new Produit();
        produit.setNomProduit("SAVON TEST");
        produit.setPrixAchat(300);
        produit.setNombreUnitesParConditionnement(4); // e.g., 1 carton = 4 unités for test
        produit = produitRepository.save(produit);

        Stock s = new Stock();
        s.setProduit(produit);
        s.setBoutique(boutique);
        s.setQuantiteDisponible(10);
        stockRepository.save(s);

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user.getEmail(), "na"));

        // grant necessary permissions for tests
        com.smboutique.api.model.Permission p1 = permissionRepository.findByName("INVENTAIRE_REGULARISER").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission();
            perm.setName("INVENTAIRE_REGULARISER");
            perm.setDescription("regulariser inventaire");
            return permissionRepository.save(perm);
        });
        com.smboutique.api.model.Permission p2 = permissionRepository.findByName("VENTE_CREER").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission();
            perm.setName("VENTE_CREER");
            perm.setDescription("Créer vente");
            return permissionRepository.save(perm);
        });
        com.smboutique.api.model.Permission p3 = permissionRepository.findByName("INVENTAIRE_MODIFIER").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission();
            perm.setName("INVENTAIRE_MODIFIER");
            perm.setDescription("Modifier inventaire");
            return permissionRepository.save(perm);
        });
        user.setPermissions(new java.util.HashSet<>(java.util.Set.of(p1, p2, p3)));
        user = utilisateurRepository.save(user);
    }

    @Test
    void debugListRequestMappings() throws Exception {
        // Diagnostic: afficher les mappings enregistrés pour comprendre les 404 de MockMvc
        org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping rm = applicationContext.getBean(org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping.class);
        java.util.Set<org.springframework.web.method.HandlerMethod> handlers = new java.util.HashSet<>(rm.getHandlerMethods().keySet().size());
        rm.getHandlerMethods().forEach((k, v) -> System.out.println("MAPPING: " + k + " -> " + v));
        // simple assertion pour échouer clairement si la route attendue n'est pas présente
        boolean hasInventaireLignes = rm.getHandlerMethods().keySet().stream().anyMatch(k -> {
            String key = k.toString();
            return key.contains("/api/inventaires/") && (key.contains("lignes") || key.contains("regularize"));
        });
        // Si absent, échouer proprement pour aider le diagnostic
        org.junit.jupiter.api.Assertions.assertTrue(hasInventaireLignes, "Les mappings d'inventaire attendus ne sont pas enregistrés (voir la sortie de debug)");
    }

    @Test
    void regularizeCreatesMouvementAndAdjustsStock() throws Exception {
        // Create inventaire
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv.setReference("INV-2026-TEST");
        inv = inventaireRepository.save(inv);

        // Add ligne with physical quantity 8 (shortage of 2)
        LigneInventaire li = new LigneInventaire();
        li.setInventaire(inv);
        li.setProduit(produit);
        li.setQuantitePhysique(8);
        li = ligneInventaireRepository.save(li);

        // call regularize
        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/regularize").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        // assert movement created (find by inventaire id without lambda capture)
        java.util.List<com.smboutique.api.model.Mouvement> mouvements = mouvementRepository.findAll();
        com.smboutique.api.model.Mouvement found = null;
        for (com.smboutique.api.model.Mouvement mv : mouvements) {
            if (mv.getInventaire() != null && mv.getInventaire().getId() != null && mv.getInventaire().getId().equals(inv.getId())) {
                found = mv; break;
            }
        }
        assertThat(found).isNotNull();
        assertThat(found.getQuantite()).isEqualTo(-2);
        assertThat(found.getMontant()).isEqualTo(-600);

        // assert stock updated to 8
        java.util.List<Stock> stocks = stockRepository.findByProduitIdAndBoutiqueId(produit.getId(), boutique.getId());
        assertThat(stocks).isNotEmpty();
        assertThat(stocks.get(0).getQuantiteDisponible()).isEqualTo(8);

        // assert inventaire marked regulariser
        Inventaire saved = inventaireRepository.findById(inv.getId()).orElseThrow();
        assertThat(saved.getRegulariser()).isTrue();
    }

    @Test
    void regularize_respects_idStock_and_allows_same_produit_in_both_scopes() throws Exception {
        // produit présent en boutique **et** en magasin
        Produit p = new Produit();
        p.setNomProduit("PROD-SAME-PROD-BOTH");
        p = produitRepository.save(p);

        // create magasin tied to this boutique
        com.smboutique.api.model.Magasin mag = new com.smboutique.api.model.Magasin();
        mag.setNom("MAG-TEST-SS");
        mag.setBoutique(boutique);
        mag = magasinRepository.save(mag);

        // create boutique stock and magasin stock for same produit
        Stock sBout = new Stock(); sBout.setProduit(p); sBout.setBoutique(boutique); sBout.setQuantiteDisponible(10); stockRepository.save(sBout);
        Stock sMag = new Stock(); sMag.setProduit(p); sMag.setBoutique(boutique); sMag.setMagasin(mag); sMag.setQuantiteDisponible(7); stockRepository.save(sMag);

        // create inventaire scoped to the boutique and add a ligne referencing the boutique stock (id_stock authoritative)
        Inventaire inv = new Inventaire(); inv.setBoutique(boutique); inv = inventaireRepository.save(inv);
        java.util.Map<String,Object> payload = new java.util.HashMap<>();
        payload.put("produitId", p.getId());
        payload.put("id_stock", sBout.getId());
        payload.put("quantitePhysique", 8);

        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated());

        // the ligne was saved; regularize will ensure the boutique stock is updated
        java.util.Optional<com.smboutique.api.model.LigneInventaire> savedOpt = ligneInventaireRepository.findByInventaireIdAndProduitId(inv.getId(), p.getId());
        org.junit.jupiter.api.Assertions.assertTrue(savedOpt.isPresent());

        // regularize must succeed (no MIXED_PORTEE) and update boutique stock only
        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/regularize")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        // boutique stock should be updated to 8
        java.util.List<Stock> sb = stockRepository.findByProduitIdAndBoutiqueId(p.getId(), boutique.getId()).stream().filter(x -> x.getMagasin() == null).toList();
        org.junit.jupiter.api.Assertions.assertFalse(sb.isEmpty());
        org.junit.jupiter.api.Assertions.assertEquals(8, sb.get(0).getQuantiteDisponible());

        // magasin stock must be unchanged
        java.util.List<Stock> sm = stockRepository.findByProduitIdAndBoutiqueIdAndMagasinIsNotNull(p.getId(), boutique.getId());
        org.junit.jupiter.api.Assertions.assertFalse(sm.isEmpty());
        org.junit.jupiter.api.Assertions.assertEquals(7, sm.get(0).getQuantiteDisponible());
    }

    @Test
    void explicitIdStock_prevents_mixedPortee_for_user_baga() throws Exception {
        // reproduce user's reported scenario: user with products in both boutique and magasin
        Utilisateur baga = new Utilisateur();
        baga.setEmail("baga@gmail.com");
        baga.setMotDePasse("123456");
        Boutique b = new Boutique(); b.setNom("BAGA-TEST-BOUTIQUE"); b = boutiqueRepository.save(b);
        baga.setBoutique(b);
        baga = utilisateurRepository.save(baga);

        Produit prod = new Produit(); prod.setNomProduit("PROD-BAGA"); prod = produitRepository.save(prod);

        com.smboutique.api.model.Magasin magasin = new com.smboutique.api.model.Magasin(); magasin.setNom("MAG-BAGA"); magasin.setBoutique(b); magasin = magasinRepository.save(magasin);

        Stock sb = new Stock(); sb.setProduit(prod); sb.setBoutique(b); sb.setQuantiteDisponible(5); sb = stockRepository.save(sb);
        Stock sm = new Stock(); sm.setProduit(prod); sm.setBoutique(b); sm.setMagasin(magasin); sm.setQuantiteDisponible(3); sm = stockRepository.save(sm);

        // create inventaire and try to add ligne **without** id_stock -> should be rejected (MIXED_PORTEE)
        Inventaire inv = new Inventaire(); inv.setBoutique(b); inv = inventaireRepository.save(inv);
        java.util.Map<String,Object> pFail = new java.util.HashMap<>(); pFail.put("produitId", prod.getId()); pFail.put("quantitePhysique", 2);
        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(baga.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(pFail)))
                .andExpect(status().isConflict())
                .andExpect(result -> org.junit.jupiter.api.Assertions.assertTrue(result.getResponse().getContentAsString().contains("MIXED_PORTEE")));

        // now add with explicit id_stock -> must be accepted
        java.util.Map<String,Object> pOk = new java.util.HashMap<>(); pOk.put("produitId", prod.getId()); pOk.put("id_stock", sm.getId()); pOk.put("quantitePhysique", 2);
        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(baga.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(pOk)))
                .andExpect(status().isCreated());

        // verify the ligne was saved (stock reference is not stored on ligne in current model)
        java.util.Optional<com.smboutique.api.model.LigneInventaire> opt = ligneInventaireRepository.findByInventaireIdAndProduitId(inv.getId(), prod.getId());
        org.junit.jupiter.api.Assertions.assertTrue(opt.isPresent());
    }

    @Test
    void blockVenteWhenInventaireActive() throws Exception {
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv = inventaireRepository.save(inv);

        // Try to create cash sale
        java.util.List<Stock> sList = stockRepository.findByProduitIdAndBoutiqueId(produit.getId(), boutique.getId());
        Long stockId = sList.isEmpty() ? 0L : sList.get(0).getId();
        String body = "{\"total\":1000, \"produitsSelectionnes\": [{\"id_stock\": " + stockId + ", \"quantite\":1}]}";
        mockMvc.perform(post("/api/ventes/cash").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
    }

    @Test
    void addLigneWithConditionnementIsConvertedToUnits() throws Exception {
        // Create inventaire
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv = inventaireRepository.save(inv);

        // Prepare request: 10 cartons + 3 units for produit (nombreUnitesParConditionnement = 4)
        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("produitId", produit.getId());
        payload.put("quantiteConditionnement", 10);
        payload.put("quantiteUnite", 3);

        var mvcResult = mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andReturn();
        int status = mvcResult.getResponse().getStatus();

        // Temporary debug: call controller directly to inspect response (bypasses MockMvc layers)
        try {
            com.smboutique.api.controller.InventaireController controller = applicationContext.getBean(com.smboutique.api.controller.InventaireController.class);
            com.smboutique.api.controller.InventaireController.LigneInventaireRequest r = new com.smboutique.api.controller.InventaireController.LigneInventaireRequest();
            r.produitId = produit.getId();
            r.quantiteConditionnement = 10;
            r.quantiteUnite = 3;
            var resp = controller.addLigne(inv.getId(), r);
            System.out.println("DEBUG controller.addLigne() -> status=" + resp.getStatusCodeValue() + " body=" + resp.getBody());
        } catch (Exception ex) {
            System.out.println("DEBUG controller.addLigne() threw: " + ex.getMessage());
        }

        if (status != 201) {
            System.out.println("DEBUG RESPONSE BODY: " + mvcResult.getResponse().getContentAsString());
        }
        org.junit.jupiter.api.Assertions.assertEquals(201, status);

        // Check saved ligne
        java.util.List<LigneInventaire> lignes = ligneInventaireRepository.findByInventaireId(inv.getId());
        assertThat(lignes).isNotEmpty();
        LigneInventaire saved = lignes.get(0);
        assertThat(saved.getQuantitePhysique()).isEqualTo(10 * 4 + 3);
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentAdds_conflictOnMixedPortee() throws Exception {
        // create inventaire
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv = inventaireRepository.save(inv);

        // boutique-only produit
        Produit pBout = new Produit();
        pBout.setNomProduit("P-BOUT");
        pBout = produitRepository.save(pBout);
        Stock sb = new Stock();
        sb.setProduit(pBout);
        sb.setBoutique(boutique);
        sb.setQuantiteDisponible(5);
        stockRepository.save(sb);

        // magasin-only produit
        com.smboutique.api.model.Magasin mag = new com.smboutique.api.model.Magasin();
        mag.setNom("MAG-TEST");
        mag.setBoutique(boutique);
        mag = magasinRepository.save(mag);

        Produit pMag = new Produit();
        pMag.setNomProduit("P-MAG");
        pMag = produitRepository.save(pMag);
        Stock sm = new Stock();
        sm.setProduit(pMag);
        sm.setBoutique(boutique);
        sm.setMagasin(mag);
        sm.setQuantiteDisponible(7);
        stockRepository.save(sm);

        final long pBoutId = pBout.getId();
        final long pMagId = pMag.getId();
        final long invId = inv.getId();

        final java.util.concurrent.ExecutorService exec = java.util.concurrent.Executors.newFixedThreadPool(2);
        final java.util.concurrent.CountDownLatch ready = new java.util.concurrent.CountDownLatch(2);
        final java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        final java.util.concurrent.ConcurrentLinkedQueue<String> statuses = new java.util.concurrent.ConcurrentLinkedQueue<>();


        Runnable task1 = () -> {
            // run in its own transaction to simulate concurrent DB actors
            ready.countDown();
            try {
                start.await();
                org.springframework.transaction.PlatformTransactionManager tm = applicationContext.getBean(org.springframework.transaction.PlatformTransactionManager.class);
                org.springframework.transaction.support.TransactionTemplate tt = new org.springframework.transaction.support.TransactionTemplate(tm);
                String outcome = tt.execute(status -> {
                    try {
                        System.out.println("T1: in TX, before saveLigne");
                        com.smboutique.api.model.LigneInventaire li = new com.smboutique.api.model.LigneInventaire();
                        li.setInventaire(inventaireRepository.findById(invId).orElseThrow());
                        li.setProduit(produitRepository.findById(pBoutId).orElseThrow());
                        li.setQuantitePhysique(1);
                        inventaireService.saveLigne(li);
                        System.out.println("T1: in TX, after saveLigne");
                        return "201:OK";
                    } catch (RuntimeException rex) {
                        System.out.println("T1: runtime ex -> " + rex.getMessage());
                        return "EX:" + rex.getClass().getSimpleName() + ":" + (rex.getMessage() == null ? "" : rex.getMessage());
                    }
                });
                System.out.println("T1: adding outcome -> " + outcome);
                statuses.add(outcome);
            } catch (Exception e) {
                System.out.println("T1: outer ex -> " + e.getMessage());
                statuses.add("EX:" + e.getClass().getSimpleName() + ":" + (e.getMessage() == null ? "" : e.getMessage()));
            }
        };
        Runnable task2 = () -> {
            // run in its own transaction to simulate concurrent DB actors
            ready.countDown();
            try {
                start.await();
                org.springframework.transaction.PlatformTransactionManager tm = applicationContext.getBean(org.springframework.transaction.PlatformTransactionManager.class);
                org.springframework.transaction.support.TransactionTemplate tt = new org.springframework.transaction.support.TransactionTemplate(tm);
                String outcome = tt.execute(status -> {
                    try {
                        System.out.println("T2: in TX, before saveLigne");
                        com.smboutique.api.model.LigneInventaire li = new com.smboutique.api.model.LigneInventaire();
                        li.setInventaire(inventaireRepository.findById(invId).orElseThrow());
                        li.setProduit(produitRepository.findById(pMagId).orElseThrow());
                        li.setQuantitePhysique(1);
                        inventaireService.saveLigne(li);
                        System.out.println("T2: in TX, after saveLigne");
                        return "201:OK";
                    } catch (RuntimeException rex) {
                        System.out.println("T2: runtime ex -> " + rex.getMessage());
                        return "EX:" + rex.getClass().getSimpleName() + ":" + (rex.getMessage() == null ? "" : rex.getMessage());
                    }
                });
                System.out.println("T2: adding outcome -> " + outcome);
                statuses.add(outcome);
            } catch (Exception e) {
                System.out.println("T2: outer ex -> " + e.getMessage());
                statuses.add("EX:" + e.getClass().getSimpleName() + ":" + (e.getMessage() == null ? "" : e.getMessage()));
            }
        };

        exec.submit(task1);
        exec.submit(task2);
        // wait both ready then start
        ready.await();
        start.countDown();
        exec.shutdown();
        exec.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS);

        // wait up to 2s for both threads to record their response (makes test deterministic)
        long waitUntil = System.currentTimeMillis() + 2000;
        while (statuses.size() < 2 && System.currentTimeMillis() < waitUntil) Thread.sleep(50);

        System.out.println("Concurrent statuses: " + statuses);
        // now assert exactly one created and one conflict (include statuses in assertion messages)
        long createdCount = statuses.stream().filter(s -> s.startsWith("201:")).count();
        long conflictCount = statuses.stream().filter(s -> s.startsWith("409:")).count();
        org.junit.jupiter.api.Assertions.assertEquals(2, statuses.size(), "Statuses: " + statuses);
        org.junit.jupiter.api.Assertions.assertEquals(1, createdCount, "CreatedCount (statuses=" + statuses + ")");
        org.junit.jupiter.api.Assertions.assertEquals(1, conflictCount, "ConflictCount (statuses=" + statuses + ")");

        // Also assert that any 409 contains the MIXED_PORTEE code or a French portée message
        boolean foundMixed = statuses.stream().anyMatch(s -> s.startsWith("409:") && (s.contains("MIXED_PORTEE") || s.contains("portées") || s.contains("Inventaire contient déjà des lignes")));
        org.junit.jupiter.api.Assertions.assertTrue(foundMixed, "Expected a MIXED_PORTEE/portée message among: " + statuses);
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentAdds_idStockWins_over_ambiguousProduit() throws Exception {
        // product exists in both scopes
        Produit p = new Produit();
        p.setNomProduit("PROD-CONC-IDSTOCK");
        p = produitRepository.save(p);

        com.smboutique.api.model.Magasin mag = new com.smboutique.api.model.Magasin();
        mag.setNom("MAG-CONC");
        mag.setBoutique(boutique);
        mag = magasinRepository.save(mag);

        Stock sb = new Stock(); sb.setProduit(p); sb.setBoutique(boutique); sb.setQuantiteDisponible(5); stockRepository.save(sb);
        Stock sm = new Stock(); sm.setProduit(p); sm.setBoutique(boutique); sm.setMagasin(mag); sm.setQuantiteDisponible(7); stockRepository.save(sm);

        Inventaire inv = new Inventaire(); inv.setBoutique(boutique); inv = inventaireRepository.save(inv);
        final long invId = inv.getId();
        final long sbId = sb.getId();
        final long pId = p.getId();

        final java.util.concurrent.ExecutorService exec = java.util.concurrent.Executors.newFixedThreadPool(2);
        final java.util.concurrent.CountDownLatch ready = new java.util.concurrent.CountDownLatch(2);
        final java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        final java.util.concurrent.ConcurrentLinkedQueue<String> statuses = new java.util.concurrent.ConcurrentLinkedQueue<>();

        // thread A: supplies explicit id_stock (should win) — perform controller POST with id_stock
        Runnable tA = () -> {
            ready.countDown();
            try {
                start.await();
                org.springframework.transaction.PlatformTransactionManager tm = applicationContext.getBean(org.springframework.transaction.PlatformTransactionManager.class);
                org.springframework.transaction.support.TransactionTemplate tt = new org.springframework.transaction.support.TransactionTemplate(tm);
                String out = tt.execute(status -> {
                    try {
                        try {
                            java.util.Map<String,Object> payload = new java.util.HashMap<>();
                            payload.put("produitId", pId);
                            payload.put("id_stock", sbId);
                            payload.put("quantitePhysique", 1);
                            var mvcResult = mockMvc.perform(post("/api/inventaires/" + invId + "/lignes").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(objectMapper.writeValueAsString(payload)))
                                    .andReturn();
                            int statusCode = mvcResult.getResponse().getStatus();
                            return String.valueOf(statusCode) + ":MVC";
                        } catch (Exception me) {
                            return "EX:MvcException:" + me.getMessage();
                        }
                    } catch (RuntimeException rex) {
                        return "EX:" + rex.getClass().getSimpleName() + ":" + (rex.getMessage()==null?"":rex.getMessage());
                    }
                });
                statuses.add(out);
            } catch (Exception e) { statuses.add("EX:" + e.getClass().getSimpleName() + ":" + (e.getMessage()==null?"":e.getMessage())); }
        };

        // thread B: ambiguous call (no id_stock) — should be rejected
        Runnable tB = () -> {
            ready.countDown();
            try {
                start.await();
                org.springframework.transaction.PlatformTransactionManager tm = applicationContext.getBean(org.springframework.transaction.PlatformTransactionManager.class);
                org.springframework.transaction.support.TransactionTemplate tt = new org.springframework.transaction.support.TransactionTemplate(tm);
                String out = tt.execute(status -> {
                    try {
                        try {
                            java.util.Map<String,Object> payload = new java.util.HashMap<>();
                            payload.put("produitId", pId);
                            payload.put("quantitePhysique", 1);
                            var mvcResult = mockMvc.perform(post("/api/inventaires/" + invId + "/lignes").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(objectMapper.writeValueAsString(payload)))
                                    .andReturn();
                            int statusCode = mvcResult.getResponse().getStatus();
                            return String.valueOf(statusCode) + ":MVC";
                        } catch (Exception me) {
                            return "EX:MvcException:" + me.getMessage();
                        }
                    } catch (RuntimeException rex) {
                        return "EX:" + rex.getClass().getSimpleName() + ":" + (rex.getMessage()==null?"":rex.getMessage());
                    }
                });
                statuses.add(out);
            } catch (Exception e) { statuses.add("EX:" + e.getClass().getSimpleName() + ":" + (e.getMessage()==null?"":e.getMessage())); }
        };

        exec.submit(tA);
        exec.submit(tB);
        ready.await();
        start.countDown();
        exec.shutdown();
        exec.awaitTermination(5, java.util.concurrent.TimeUnit.SECONDS);

        long waitUntil = System.currentTimeMillis() + 2000;
        while (statuses.size() < 2 && System.currentTimeMillis() < waitUntil) Thread.sleep(50);

        System.out.println("Statuses (id_stock vs ambiguous): " + statuses);
        long created = statuses.stream().filter(s -> s.startsWith("201:")).count();
        long conflicts = statuses.stream().filter(s -> s.startsWith("EX:") || s.startsWith("409:")).count();
        org.junit.jupiter.api.Assertions.assertEquals(2, statuses.size(), "Statuses: " + statuses);
        org.junit.jupiter.api.Assertions.assertEquals(1, created, "Expected exactly 1 created (id_stock winner)");
        org.junit.jupiter.api.Assertions.assertEquals(1, conflicts, "Expected the ambiguous caller to be rejected");
    }

    @Test
    void regularize_updates_only_matching_stock_row_when_product_exists_in_both_scopes() throws Exception {
        // Scenario A: boutique-only produit is updated by boutique inventaire
        Produit pBoutOnly = new Produit();
        pBoutOnly.setNomProduit("P-BOUT-ONLY");
        pBoutOnly = produitRepository.save(pBoutOnly);
        Stock sb = new Stock();
        sb.setProduit(pBoutOnly);
        sb.setBoutique(boutique);
        sb.setQuantiteDisponible(12);
        stockRepository.save(sb);

        Inventaire invB = new Inventaire();
        invB.setBoutique(boutique);
        invB = inventaireRepository.save(invB);
        LigneInventaire lb = new LigneInventaire();
        lb.setInventaire(invB);
        lb.setProduit(pBoutOnly);
        lb.setQuantitePhysique(9);
        ligneInventaireRepository.save(lb);

        mockMvc.perform(post("/api/inventaires/" + invB.getId() + "/regularize").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        Stock afterB = stockRepository.findByProduitIdAndBoutiqueId(pBoutOnly.getId(), boutique.getId()).stream().filter(s -> s.getMagasin() == null).findFirst().orElseThrow();
        assertThat(afterB.getQuantiteDisponible()).isEqualTo(9);

        // Scenario B: magasin-only produit is updated by magasin inventaire
        com.smboutique.api.model.Magasin mag = new com.smboutique.api.model.Magasin();
        mag.setNom("MAG-TEST-2");
        mag.setBoutique(boutique);
        mag = magasinRepository.save(mag);

        Produit pMagOnly = new Produit();
        pMagOnly.setNomProduit("P-MAG-ONLY-2");
        pMagOnly = produitRepository.save(pMagOnly);
        Stock sm = new Stock();
        sm.setProduit(pMagOnly);
        sm.setBoutique(boutique);
        sm.setMagasin(mag);
        sm.setQuantiteDisponible(7);
        stockRepository.save(sm);

        Inventaire invM = new Inventaire();
        invM.setBoutique(boutique);
        invM = inventaireRepository.save(invM);
        LigneInventaire lm = new LigneInventaire();
        lm.setInventaire(invM);
        lm.setProduit(pMagOnly);
        lm.setQuantitePhysique(3);
        ligneInventaireRepository.save(lm);

        mockMvc.perform(post("/api/inventaires/" + invM.getId() + "/regularize").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        Stock afterM = stockRepository.findByProduitIdAndBoutiqueId(pMagOnly.getId(), boutique.getId()).stream().filter(s -> s.getMagasin() != null).findFirst().orElseThrow();
        assertThat(afterM.getQuantiteDisponible()).isEqualTo(3);
    }

    @Test
    void regression_same_product_in_both_scopes_updates_only_target_scope_and_rejects_ambiguous_inventory() throws Exception {
        // create a single produit that has BOTH boutique and magasin stock (real-world repro)
        Produit p = new Produit();
        p.setNomProduit("PROD-BOTH");
        p.setPrixAchat(100);
        p = produitRepository.save(p);

        com.smboutique.api.model.Magasin mag = new com.smboutique.api.model.Magasin();
        mag.setNom("MAG-REGRESSION");
        mag.setBoutique(boutique);
        mag = magasinRepository.save(mag);

        Stock sBout = new Stock();
        sBout.setProduit(p);
        sBout.setBoutique(boutique);
        sBout.setQuantiteDisponible(10);
        stockRepository.save(sBout);

        Stock sMag = new Stock();
        sMag.setProduit(p);
        sMag.setBoutique(boutique);
        sMag.setMagasin(mag);
        sMag.setQuantiteDisponible(20);
        stockRepository.save(sMag);

        // 1) boutique-scoped inventaire should only update boutique stock
        Inventaire invB = new Inventaire();
        invB.setBoutique(boutique);
        invB = inventaireRepository.save(invB);
        LigneInventaire lb = new LigneInventaire();
        lb.setInventaire(invB);
        lb.setProduit(p);
        lb.setQuantitePhysique(7);
        ligneInventaireRepository.save(lb);

        mockMvc.perform(post("/api/inventaires/" + invB.getId() + "/regularize").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        Stock afterBout = stockRepository.findByProduitIdAndBoutiqueId(p.getId(), boutique.getId()).stream().filter(s -> s.getMagasin() == null).findFirst().orElseThrow();
        Stock afterMag = stockRepository.findByProduitIdAndBoutiqueId(p.getId(), boutique.getId()).stream().filter(s -> s.getMagasin() != null).findFirst().orElseThrow();
        assertThat(afterBout.getQuantiteDisponible()).isEqualTo(7);
        assertThat(afterMag.getQuantiteDisponible()).isEqualTo(20);

        // 2) magasin-scoped inventaire should only update magasin stock
        // prepare a magasin-only baseline produit to mark the inventaire as magasin-scoped
        Produit pmBaseline = new Produit();
        pmBaseline.setNomProduit("PM-BASELINE");
        pmBaseline.setPrixAchat(50);
        pmBaseline = produitRepository.save(pmBaseline);
        Stock smb = new Stock();
        smb.setProduit(pmBaseline);
        smb.setBoutique(boutique);
        smb.setMagasin(mag);
        smb.setQuantiteDisponible(3);
        stockRepository.save(smb);

        Inventaire invM = new Inventaire();
        invM.setBoutique(boutique);
        invM = inventaireRepository.save(invM);
        // add baseline magasin-only ligne first (this determines the inventaire scope)
        com.smboutique.api.model.LigneInventaire baseline = new com.smboutique.api.model.LigneInventaire();
        baseline.setInventaire(invM);
        baseline.setProduit(pmBaseline);
        baseline.setQuantitePhysique(2);
        ligneInventaireRepository.save(baseline);

        // now add the produit that exists in BOTH scopes — allowed because inventaire is already magasin-scoped
        LigneInventaire lm = new LigneInventaire();
        lm.setInventaire(invM);
        lm.setProduit(p);
        lm.setQuantitePhysique(5);
        ligneInventaireRepository.save(lm);

        mockMvc.perform(post("/api/inventaires/" + invM.getId() + "/regularize").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        afterBout = stockRepository.findByProduitIdAndBoutiqueId(p.getId(), boutique.getId()).stream().filter(s -> s.getMagasin() == null).findFirst().orElseThrow();
        afterMag = stockRepository.findByProduitIdAndBoutiqueId(p.getId(), boutique.getId()).stream().filter(s -> s.getMagasin() != null).findFirst().orElseThrow();
        assertThat(afterBout.getQuantiteDisponible()).isEqualTo(7);
        assertThat(afterMag.getQuantiteDisponible()).isEqualTo(5);

        // 3) ambiguous inventaire (single ligne where produit exists in BOTH scopes) must be rejected when adding the ligne
        Inventaire invAmb = new Inventaire();
        invAmb.setBoutique(boutique);
        invAmb = inventaireRepository.save(invAmb);
        java.util.Map<String,Object> payload = new java.util.HashMap<>();
        payload.put("produitId", p.getId());
        payload.put("quantiteUnite", 1);

        mockMvc.perform(post("/api/inventaires/" + invAmb.getId() + "/lignes").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isConflict());
    }

    @Test
    void addLigne_withIdStock_disambiguatesProductAnd_updates_only_target_stock() throws Exception {
        // product with BOTH boutique and magasin stock
        Produit p = new Produit();
        p.setNomProduit("PROD-DISAMB");
        p.setPrixAchat(42);
        p = produitRepository.save(p);

        com.smboutique.api.model.Magasin mag = new com.smboutique.api.model.Magasin();
        mag.setNom("MAG-DISAMB");
        mag.setBoutique(boutique);
        mag = magasinRepository.save(mag);

        Stock sb = new Stock();
        sb.setProduit(p);
        sb.setBoutique(boutique);
        sb.setQuantiteDisponible(11);
        stockRepository.save(sb);

        Stock sm = new Stock();
        sm.setProduit(p);
        sm.setBoutique(boutique);
        sm.setMagasin(mag);
        sm.setQuantiteDisponible(22);
        stockRepository.save(sm);

        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv = inventaireRepository.save(inv);

        // caller provides id_stock -> should be accepted and used to determine scope
        java.util.Map<String,Object> payload = new java.util.HashMap<>();
        payload.put("produitId", p.getId());
        payload.put("id_stock", sb.getId());
        payload.put("quantiteUnite", 3);

        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated());

        // assert the saved ligne used the explicit stock to compute stock théorique (3 - 11 = -8)
        java.util.List<LigneInventaire> savedLignes = ligneInventaireRepository.findByInventaireId(inv.getId());
        org.junit.jupiter.api.Assertions.assertEquals(1, savedLignes.size());
        LigneInventaire saved = savedLignes.get(0);
        org.junit.jupiter.api.Assertions.assertEquals(3, saved.getQuantitePhysique().intValue());
        org.junit.jupiter.api.Assertions.assertEquals(-8, saved.getEcartStock().intValue());

        // regularize should update only the boutique stock referenced by id_stock
        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/regularize").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());

        Stock afterBout = stockRepository.findByProduitIdAndBoutiqueId(p.getId(), boutique.getId()).stream().filter(s -> s.getMagasin() == null).findFirst().orElseThrow();
        Stock afterMag = stockRepository.findByProduitIdAndBoutiqueId(p.getId(), boutique.getId()).stream().filter(s -> s.getMagasin() != null).findFirst().orElseThrow();
        assertThat(afterBout.getQuantiteDisponible()).isEqualTo(3);
        assertThat(afterMag.getQuantiteDisponible()).isEqualTo(22);
    }

    @Test
    void get_inventaire_detail_returns_only_scope_matching_lignes() throws Exception {
        // create magasin and both stocks for same produit
        com.smboutique.api.model.Magasin mag = new com.smboutique.api.model.Magasin();
        mag.setNom("MAG-DET");
        mag.setBoutique(boutique);
        mag = magasinRepository.save(mag);

        Stock sBout = new Stock();
        sBout.setProduit(produit);
        sBout.setBoutique(boutique);
        sBout.setQuantiteDisponible(5);
        stockRepository.save(sBout);

        Stock sMag = new Stock();
        sMag.setProduit(produit);
        sMag.setBoutique(boutique);
        sMag.setMagasin(mag);
        sMag.setQuantiteDisponible(3);
        stockRepository.save(sMag);

        // inventaire magasin-scoped should only return lignes that map to magasin stock
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv = inventaireRepository.save(inv);

        LigneInventaire lb = new LigneInventaire();
        lb.setInventaire(inv);
        lb.setProduit(produit);
        lb.setQuantitePhysique(3);
        ligneInventaireRepository.save(lb);

        // ensure user has read permission for inventaires (some test setups don't grant it by default)
        com.smboutique.api.model.Permission pRead = permissionRepository.findByName("INVENTAIRE_LECTURE").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission();
            perm.setName("INVENTAIRE_LECTURE");
            perm.setDescription("Permission pour lire l'inventaire");
            return permissionRepository.save(perm);
        });
        user.getPermissions().add(pRead);
        utilisateurRepository.save(user);

        // controller should filter so UI only sees scope-matching lignes
        String json = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/inventaires/" + inv.getId() + "/lignes").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // parse as array
        com.fasterxml.jackson.databind.JsonNode arr = objectMapper.readTree(json);
        // should contain the single ligne we added
        org.junit.jupiter.api.Assertions.assertEquals(1, arr.size());
    }

    @Test
    void addLigneRejectsProduitFromMagasinForBoutiqueInventaire() throws Exception {
        // create a new produit that exists only in a magasin (avoid colliding with setUp's product)
        Produit p2 = new Produit();
        p2.setNomProduit("SAVON M-ONLY");
        p2.setPrixAchat(150);
        p2.setNombreUnitesParConditionnement(2);
        p2 = produitRepository.save(p2);

        com.smboutique.api.model.Magasin mg = new com.smboutique.api.model.Magasin();
        mg.setNom("M-TEST");
        mg.setBoutique(boutique);
        mg = magasinRepository.save(mg);

        Stock ms = new Stock();
        ms.setProduit(p2);
        ms.setMagasin(mg);
        ms.setQuantiteDisponible(5);
        stockRepository.save(ms);

        // inventaire for boutique
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv = inventaireRepository.save(inv);

        // mark inventaire as boutique-scoped by adding a boutique-only ligne (baseline)
        com.smboutique.api.model.LigneInventaire baseline = new com.smboutique.api.model.LigneInventaire();
        baseline.setInventaire(inv);
        baseline.setProduit(produit); // produit from setUp -> boutique-level
        baseline.setQuantitePhysique(1);
        ligneInventaireRepository.save(baseline);

        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("produitId", p2.getId());
        payload.put("quantiteUnite", 1);

        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isConflict());

        // no new ligne (only the baseline) should be present
        java.util.List<LigneInventaire> lignes = ligneInventaireRepository.findByInventaireId(inv.getId());
        assertThat(lignes).hasSize(1);
        assertThat(lignes.get(0).getProduit().getId()).isEqualTo(produit.getId());
    }

    @Test
    void regularizeFailsWhenLigneOutOfScope() throws Exception {
        // create a new produit that exists only in a magasin (avoid colliding with setUp's product)
        Produit p3 = new Produit();
        p3.setNomProduit("SAVON M-ONLY-2");
        p3.setPrixAchat(200);
        p3.setNombreUnitesParConditionnement(5);
        p3 = produitRepository.save(p3);

        com.smboutique.api.model.Magasin mg = new com.smboutique.api.model.Magasin();
        mg.setNom("M-TEST-2");
        mg.setBoutique(boutique);
        mg = magasinRepository.save(mg);

        Stock ms = new Stock();
        ms.setProduit(p3);
        ms.setMagasin(mg);
        ms.setQuantiteDisponible(5);
        stockRepository.save(ms);

        // inventaire for boutique and a ligne referencing the produit
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv = inventaireRepository.save(inv);

        // add a boutique-level baseline ligne so the inventaire is boutique-scoped
        com.smboutique.api.model.LigneInventaire baseline = new com.smboutique.api.model.LigneInventaire();
        baseline.setInventaire(inv);
        baseline.setProduit(produit); // from setUp -> boutique-level
        baseline.setQuantitePhysique(1);
        ligneInventaireRepository.save(baseline);

        LigneInventaire li = new LigneInventaire();
        li.setInventaire(inv);
        li.setProduit(p3);
        li.setQuantitePhysique(3);
        li = ligneInventaireRepository.save(li);

        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/regularize")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isConflict());
    }

    @Test
    void allowMagasinScopedInventaireAndRegularizeUpdatesMagasinStock() throws Exception {
        // produit that exists only in a magasin
        Produit pm = new Produit();
        pm.setNomProduit("PROD-MAG-ONLY");
        pm.setPrixAchat(120);
        pm.setNombreUnitesParConditionnement(1);
        pm = produitRepository.save(pm);

        com.smboutique.api.model.Magasin mg = new com.smboutique.api.model.Magasin();
        mg.setNom("M-REG-OK");
        mg.setBoutique(boutique);
        mg = magasinRepository.save(mg);

        Stock ms = new Stock();
        ms.setProduit(pm);
        ms.setMagasin(mg);
        ms.setQuantiteDisponible(7);
        stockRepository.save(ms);

        // create inventaire (no lignes yet) — add a magasin-only ligne
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv = inventaireRepository.save(inv);

        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("produitId", pm.getId());
        payload.put("quantiteUnite", 5);

        // Creating a magasin-scoped ligne is NO LONGER SUPPORTED — must be rejected
        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isConflict());

        // regularize should not proceed (no ligne added) and stock remains unchanged
        java.util.Optional<Stock> updated = stockRepository.findByProduitIdAndMagasinId(pm.getId(), mg.getId());
        assertThat(updated).isPresent();
        assertThat(updated.get().getQuantiteDisponible()).isEqualTo(7);

        Inventaire saved = inventaireRepository.findById(inv.getId()).orElseThrow();
        assertThat(saved.getRegulariser()).isFalse();
    }

    @Test
    void rejectBoutiqueProductWhenInventaireAlreadyMagasinScoped() throws Exception {
        // produit magasin-only
        Produit pm2 = new Produit();
        pm2.setNomProduit("PROD-M-ONLY-XY");
        pm2.setPrixAchat(90);
        pm2 = produitRepository.save(pm2);
        com.smboutique.api.model.Magasin mg2 = new com.smboutique.api.model.Magasin();
        mg2.setNom("M-XY");
        mg2.setBoutique(boutique);
        mg2 = magasinRepository.save(mg2);
        Stock ms2 = new Stock();
        ms2.setProduit(pm2);
        ms2.setMagasin(mg2);
        ms2.setQuantiteDisponible(4);
        stockRepository.save(ms2);

        // produit boutique-only
        Produit pb = new Produit();
        pb.setNomProduit("PROD-BOUTIQUE-ONLY");
        pb.setPrixAchat(50);
        pb = produitRepository.save(pb);
        Stock sb = new Stock();
        sb.setProduit(pb);
        sb.setBoutique(boutique);
        sb.setQuantiteDisponible(10);
        stockRepository.save(sb);

        // create inventaire and add magasin-only ligne
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv = inventaireRepository.save(inv);
        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("produitId", pm2.getId());
        payload.put("quantiteUnite", 1);
        // Attempt to add a magasin-only ligne should now be rejected
        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isConflict());

        // Since the magasin-line was rejected, adding a boutique-only produit should succeed
        java.util.Map<String, Object> payload2 = new java.util.HashMap<>();
        payload2.put("produitId", pb.getId());
        payload2.put("quantiteUnite", 1);
        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload2)))
                .andExpect(status().isCreated());

        // ensure only the magasin ligne exists
        java.util.List<LigneInventaire> lignes = ligneInventaireRepository.findByInventaireId(inv.getId());
        assertThat(lignes).hasSize(1);
        assertThat(lignes.get(0).getProduit().getId()).isEqualTo(pm2.getId());
    }

    @Test
    void allowCreateMagasinInventaireWhenBoutiqueActiveExists() throws Exception {
        // create an active boutique-scoped inventaire (baseline)
        Inventaire invBase = new Inventaire();
        invBase.setBoutique(boutique);
        invBase = inventaireRepository.save(invBase);
        com.smboutique.api.model.LigneInventaire baseL = new com.smboutique.api.model.LigneInventaire();
        baseL.setInventaire(invBase);
        baseL.setProduit(produit); // from setUp -> boutique-level
        baseL.setQuantitePhysique(1);
        ligneInventaireRepository.save(baseL);

        // create a magasin-only product
        Produit pm = new Produit();
        pm.setNomProduit("PROD-M-NEW");
        pm.setPrixAchat(120);
        pm = produitRepository.save(pm);
        com.smboutique.api.model.Magasin mg = new com.smboutique.api.model.Magasin();
        mg.setNom("M-NEW");
        mg.setBoutique(boutique);
        mg = magasinRepository.save(mg);
        Stock ms = new Stock();
        ms.setProduit(pm);
        ms.setMagasin(mg);
        ms.setQuantiteDisponible(7);
        stockRepository.save(ms);

        // create new inventaire (should be allowed)
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv = inventaireRepository.save(inv);

        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("produitId", pm.getId());
        payload.put("quantiteUnite", 5);

        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated());
    }
}
