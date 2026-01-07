package com.smboutique.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smboutique.api.model.*;
import com.smboutique.api.repository.*;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class VenteCashControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private BoutiqueRepository boutiqueRepository;

    @Autowired
    private MagasinRepository magasinRepository;

    @Autowired
    private ProduitRepository produitRepository;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private CaisseRepository caisseRepository;

    @Autowired
    private VenteRepository venteRepository;

    @Autowired
    private LigneVenteRepository ligneVenteRepository;

    @Autowired
    private MouvementRepository mouvementRepository;

    @Autowired
    private CaisseTransactionRepository caisseTransactionRepository;

    @Autowired
    private CaisseMovementRepository caisseMovementRepository;

    private Boutique boutique;
    private Magasin magasin;
    private Utilisateur user;
    private Produit produit;
    private Stock stock;

    @BeforeEach
    void setUp() {
        boutique = new Boutique();
        boutique.setNom("B1");
        boutique = boutiqueRepository.save(boutique);

        magasin = new Magasin();
        magasin.setNom("M1");
        magasin.setBoutique(boutique);
        magasin = magasinRepository.save(magasin);

        produit = new Produit();
        produit.setNomProduit("P1");
        produit.setPrixAchat(1000);
        produit.setNombreUnitesParConditionnement(10);
        produit = produitRepository.save(produit);

        stock = new Stock();
        stock.setProduit(produit);
        // Boutique-level stock (magasin = null) per new business rules
        stock.setMagasin(null);
        stock.setBoutique(boutique);
        stock.setQuantiteDisponible(10);
        stock.setCostAverage(new BigDecimal("50.00"));
        stock.setLastPurchasePrice(new BigDecimal("50.00"));
        stock = stockRepository.save(stock);

        user = new Utilisateur();
        user.setEmail("cash@b1.local");
        user.setBoutique(boutique);
        Permission p = permissionRepository.findByName("VENTE_CREER").orElseGet(() -> {
            Permission x = new Permission(); x.setName("VENTE_CREER"); return permissionRepository.save(x);
        });
        user.setPermissions(java.util.Set.of(p));
        user = utilisateurRepository.save(user);

        // set authentication name to user's email
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user.getEmail(), "na"));

        // create active caisse
        Caisse caisse = new Caisse();
        caisse.setBoutique(boutique);
        caisse.setReference("CASH-REF-1");
        caisse.setStatut("on");
        caisse.setMontantTotal(1000);
        caisse = caisseRepository.save(caisse);
    }

    @Test
    void createVenteCash_success_decrementsStock_updatesCaisse_and_createsMouvement() throws Exception {
        var payload = Map.of(
                "reference", "CASH-1",
                "total", 5000,
                "montantRecu", 5000,
                "monnaieRembourse", 0,
                "produitsSelectionnes", List.of(Map.of("id_stock", stock.getId(), "quantite", 2, "venteParConditionnement", false, "prix", 2500, "priceMode", "DETAIL"))
        );

        mockMvc.perform(post("/api/ventes/cash")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk());

        Stock updated = stockRepository.findById(stock.getId()).orElseThrow();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(8);

        List<Vente> ventes = venteRepository.findAll();
        assertThat(ventes).isNotEmpty();
        Vente v = ventes.stream().filter(x -> Integer.valueOf(5000).equals(x.getMontantTotal()) && Integer.valueOf(5000).equals(x.getMontantRecu())).findFirst().orElseGet(() -> ventes.get(0));
        assertThat(v.getMontantTotal()).isEqualTo(5000);
        // Ensure boutique was persisted on cash sale
        assertThat(v.getBoutique()).isNotNull();
        assertThat(v.getBoutique().getId()).isEqualTo(boutique.getId());

        List<LigneVente> lvs = ligneVenteRepository.findAll();
        assertThat(lvs).isNotEmpty();
        LigneVente lv = lvs.stream().filter(a -> a.getProduit() != null && a.getProduit().getId().equals(produit.getId())).findFirst().orElseGet(() -> lvs.get(0));
        assertThat(lv.getQuantite()).isEqualTo(2);

        // Find the mouvement related to the stock we used in this test to avoid colliding with pre-existing mouvements
        List<Mouvement> mvts = mouvementRepository.findAll().stream().filter(mt -> mt.getStock() != null && mt.getStock().getId().equals(stock.getId())).toList();
        assertThat(mvts).isNotEmpty();
        Mouvement m = mvts.get(0);
        assertThat(m.getTypeMouvement()).isEqualTo("SORTIE");
        assertThat(m.getStock().getId()).isEqualTo(stock.getId());
        assertThat(m.getBoutique().getId()).isEqualTo(boutique.getId());

        Caisse c = caisseRepository.findFirstByBoutiqueIdOrderByIdDesc(boutique.getId()).orElseThrow();
        assertThat(c.getMontantTotal()).isGreaterThan(1000);

        List<com.smboutique.api.model.CaisseTransaction> txs = caisseTransactionRepository.findByReferenceCaisse(c.getReference());
        assertThat(txs).isNotEmpty();
        assertThat(txs.get(0).getType()).isEqualTo(com.smboutique.api.model.CaisseTransaction.TransactionType.CREDIT);

        List<com.smboutique.api.model.CaisseMovement> cms = caisseMovementRepository.findByReferenceCaisseOrderByCreatedAtDesc(c.getReference());
        assertThat(cms).isNotEmpty();
        assertThat(cms.get(0).getType()).isEqualTo(com.smboutique.api.model.CaisseMovement.MovementType.CREDIT);
        assertThat(cms.get(0).getBalanceAfter()).isEqualTo(c.getMontantTotal());

        // Audit-level mouvement created for the sale (filter by reference to avoid collisions)
        List<Mouvement> auditMvs = mouvementRepository.findAll().stream().filter(mt -> "VENTE".equals(mt.getTypeMouvement()) && "ESPECE".equals(mt.getSousType()) && v.getId().equals(mt.getReferenceId())).toList();
        assertThat(auditMvs).isNotEmpty();
        Mouvement audit = auditMvs.get(0);
        // Debug prints to inspect failing values
        System.out.println("DEBUG: caisse montantTotal=" + c.getMontantTotal());
        System.out.println("DEBUG: first tx type=" + (txs.isEmpty() ? "<none>" : txs.get(0).getType()) + " txsCount=" + txs.size());
        System.out.println("DEBUG: first cms balanceAfter=" + (cms.isEmpty() ? "<none>" : cms.get(0).getBalanceAfter()) + " cmsCount=" + cms.size());
        System.out.println("DEBUG: auditRef=" + audit.getReferenceId() + " auditUserId=" + (audit.getUtilisateur()!=null?audit.getUtilisateur().getId():null));

        assertThat(audit.getReferenceId()).isEqualTo(v.getId());
        assertThat(audit.getUtilisateur()).isNotNull();
        assertThat(audit.getUtilisateur().getId()).isEqualTo(user.getId());

        // CMP unchanged
        Stock after = stockRepository.findById(stock.getId()).orElseThrow();
        assertThat(after.getCostAverage()).isEqualTo(new BigDecimal("50.00"));
        produit = produitRepository.findById(produit.getId()).orElseThrow();
        assertThat(produit.getPrixAchat()).isEqualTo(1000);
    }

    @Test
    void createVente_api_persists_boutique_when_missing() throws Exception {
        var ventePayload = Map.of(
                "referenceCaisse", "API-1",
                "montantTotal", 1234
        );

        mockMvc.perform(post("/api/ventes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ventePayload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk());

        List<Vente> ventes = venteRepository.findAll();
        Vente v = ventes.stream().filter(x -> "API-1".equals(x.getReferenceCaisse())).findFirst().orElseThrow();
        assertThat(v.getBoutique()).isNotNull();
        assertThat(v.getBoutique().getId()).isEqualTo(boutique.getId());
        assertThat(v.getUtilisateur()).isNotNull();
        assertThat(v.getUtilisateur().getId()).isEqualTo(user.getId());
    }

    @Test
    void createVenteCash_insufficientStock_rollback() throws Exception {
        var payload = Map.of(
                "reference", "CASH-2",
                "total", 100000,
                "produitsSelectionnes", List.of(Map.of("id_stock", stock.getId(), "quantite", 20, "venteParConditionnement", false, "prix", 5000, "priceMode", "DETAIL"))
        );

        mockMvc.perform(post("/api/ventes/cash")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isBadRequest());

        // Verify rollback: no vente with this reference or montant persisted and stock unchanged
        boolean noMatchingVente = venteRepository.findAll().stream().noneMatch(v -> "CASH-2".equals(v.getReferenceCaisse()) || Integer.valueOf(100000).equals(v.getMontantTotal()));
        assertThat(noMatchingVente).isTrue();
        Stock updated = stockRepository.findById(stock.getId()).orElseThrow();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(10);
    }

    @Test
    void createVenteCash_conditionnement_douzaine_decrementsStock_and_createsMouvement() throws Exception {
        Produit p2 = new Produit();
        p2.setNomProduit("P2");
        p2.setPrixAchat(2000);
        p2.setNombreUnitesParConditionnement(12);
        Produit savedP2 = produitRepository.save(p2);

        Stock s2 = new Stock();
        s2.setProduit(savedP2);
        // Boutique-level stock
        s2.setMagasin(null);
        s2.setBoutique(boutique);
        s2.setQuantiteDisponible(50);
        s2.setCostAverage(new BigDecimal("50.00"));
        s2.setLastPurchasePrice(new BigDecimal("50.00"));
        Stock savedS2 = stockRepository.save(s2);

        var payload = Map.of(
                "reference", "CASH-DOZ",
                "total", 12 * 2000,
                "montantRecu", 12 * 2000,
                "monnaieRembourse", 0,
                "produitsSelectionnes", List.of(Map.of("id_stock", savedS2.getId(), "quantiteConditionnement", 1, "venteParConditionnement", true, "prix", 2000, "priceMode", "DETAIL"))
        );

        mockMvc.perform(post("/api/ventes/cash")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk());

        Stock updated = stockRepository.findById(savedS2.getId()).orElseThrow();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(38);

        List<LigneVente> lvs = ligneVenteRepository.findAll().stream().filter(l -> l.getProduit() != null && l.getProduit().getId().equals(savedP2.getId())).toList();
        assertThat(lvs).isNotEmpty();
        LigneVente lv = lvs.get(0);
        assertThat(lv.getQuantite()).isEqualTo(12);
        assertThat(lv.getQuantiteConditionnement()).isEqualTo(1);

        List<Mouvement> mvts = mouvementRepository.findAll().stream().filter(mt -> mt.getStock() != null && mt.getStock().getId().equals(savedS2.getId())).toList();
        assertThat(mvts).isNotEmpty();
        Mouvement m = mvts.get(0);
        assertThat(m.getQuantite()).isEqualTo(12);
        assertThat(m.getTypeMouvement()).isEqualTo("SORTIE");
        assertThat(m.getMontant()).isEqualTo(12 * 2000);
    }

    @Test
    void createVenteCash_conditionnement_multiplierGreaterThanOne_decrementsStock_and_createsMouvement() throws Exception {
        Produit p3 = new Produit();
        p3.setNomProduit("P3");
        p3.setPrixAchat(500);
        p3.setNombreUnitesParConditionnement(10);
        Produit savedP3 = produitRepository.save(p3);

        Stock s3 = new Stock();
        s3.setProduit(savedP3);
        // Boutique-level stock
        s3.setMagasin(null);
        s3.setQuantiteDisponible(100);
        s3.setCostAverage(new BigDecimal("25.00"));
        s3.setLastPurchasePrice(new BigDecimal("25.00"));
        Stock savedS3 = stockRepository.save(s3);

        int qCond = 3;
        int real = qCond * 10;
        int prix = 500;
        var payload = Map.of(
                "reference", "CASH-MULT",
                "total", real * prix,
                "montantRecu", real * prix,
                "monnaieRembourse", 0,
                "produitsSelectionnes", List.of(Map.of("id_stock", savedS3.getId(), "quantiteConditionnement", qCond, "venteParConditionnement", true, "prix", prix, "priceMode", "DETAIL"))
        );

        mockMvc.perform(post("/api/ventes/cash")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk());

        Stock updated = stockRepository.findById(savedS3.getId()).orElseThrow();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(100 - real);

        LigneVente lv = ligneVenteRepository.findAll().stream().filter(l -> l.getProduit() != null && l.getProduit().getId().equals(savedP3.getId())).findFirst().orElseThrow();
        assertThat(lv.getQuantite()).isEqualTo(real);
        assertThat(lv.getQuantiteConditionnement()).isEqualTo(qCond);

        Mouvement m = mouvementRepository.findAll().stream().filter(mt -> mt.getStock() != null && mt.getStock().getId().equals(savedS3.getId())).findFirst().orElseThrow();
        assertThat(m.getQuantite()).isEqualTo(real);
        assertThat(m.getMontant()).isEqualTo(real * prix);
    }

    @Test
    void createVenteCash_conditionnement_fractionnement_partial_decrementsStock_and_createsMouvement() throws Exception {
        Produit p4 = new Produit();
        p4.setNomProduit("P4");
        p4.setPrixAchat(1000);
        p4.setNombreUnitesParConditionnement(24);
        Produit savedP4 = produitRepository.save(p4);

        Stock s4 = new Stock();
        s4.setProduit(savedP4);
        s4.setMagasin(null);
        s4.setBoutique(boutique);
        s4.setQuantiteDisponible(48);
        s4.setCostAverage(new BigDecimal("100.00"));
        s4.setLastPurchasePrice(new BigDecimal("100.00"));
        Stock savedS4 = stockRepository.save(s4);

        int qCond = 1; // open 1 conditionnement (24 units)
        int soldUnits = 15; // fractional sale
        int prix = 200;
        var payload = Map.of(
                "reference", "CASH-PART",
                "total", soldUnits * prix,
                "montantRecu", soldUnits * prix,
                "monnaieRembourse", 0,
                "produitsSelectionnes", List.of(Map.of("id_stock", savedS4.getId(), "quantiteConditionnement", qCond, "quantite", soldUnits, "venteParConditionnement", true, "prix", prix, "priceMode", "DETAIL"))
        );

        mockMvc.perform(post("/api/ventes/cash")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk());

        Stock updated = stockRepository.findById(savedS4.getId()).orElseThrow();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(48 - soldUnits);

        LigneVente lv = ligneVenteRepository.findAll().stream().filter(l -> l.getProduit() != null && l.getProduit().getId().equals(savedP4.getId())).findFirst().orElseThrow();
        assertThat(lv.getQuantite()).isEqualTo(soldUnits);
        assertThat(lv.getQuantiteConditionnement()).isEqualTo(qCond);

        Mouvement m = mouvementRepository.findAll().stream().filter(mt -> mt.getStock() != null && mt.getStock().getId().equals(savedS4.getId())).findFirst().orElseThrow();
        assertThat(m.getQuantite()).isEqualTo(soldUnits);
        assertThat(m.getMontant()).isEqualTo(soldUnits * prix);
    }

    @Test
    void createVenteCash_conditionnement_fractionnement_quantiteExceedsOpened_shouldFail() throws Exception {
        Produit p5 = new Produit();
        p5.setNomProduit("P5");
        p5.setPrixAchat(1000);
        p5.setNombreUnitesParConditionnement(24);
        Produit savedP5 = produitRepository.save(p5);

        Stock s5 = new Stock();
        s5.setProduit(savedP5);
        s5.setMagasin(null);
        s5.setBoutique(boutique);
        s5.setQuantiteDisponible(100);
        s5.setCostAverage(new BigDecimal("100.00"));
        s5.setLastPurchasePrice(new BigDecimal("100.00"));
        Stock savedS5 = stockRepository.save(s5);

        int qCond = 1; // open 1 conditionnement (24 units)
        int soldUnits = 25; // invalid: more than opened
        int prix = 200;
        var payload = Map.of(
                "reference", "CASH-OVER",
                "total", soldUnits * prix,
                "montantRecu", soldUnits * prix,
                "monnaieRembourse", 0,
                "produitsSelectionnes", List.of(Map.of("id_stock", savedS5.getId(), "quantiteConditionnement", qCond, "quantite", soldUnits, "venteParConditionnement", true, "prix", prix, "priceMode", "DETAIL"))
        );

        mockMvc.perform(post("/api/ventes/cash")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isBadRequest());

        // verify stock unchanged
        Stock updated = stockRepository.findById(savedS5.getId()).orElseThrow();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(100);
    }

    @Test
    void createVenteCash_conditionnement_notAllowed_when_multiplierLessOrEqualOne() throws Exception {
        Produit p6 = new Produit();
        p6.setNomProduit("P6");
        p6.setPrixAchat(500);
        p6.setNombreUnitesParConditionnement(1); // not fractionnable
        Produit savedP6 = produitRepository.save(p6);

        Stock s6 = new Stock();
        s6.setProduit(savedP6);
        s6.setMagasin(null);
        s6.setBoutique(boutique);
        s6.setQuantiteDisponible(50);
        s6.setCostAverage(new BigDecimal("20.00"));
        s6.setLastPurchasePrice(new BigDecimal("20.00"));
        Stock savedS6 = stockRepository.save(s6);

        var payload = Map.of(
                "reference", "CASH-NOCOND",
                "total", 1000,
                "montantRecu", 1000,
                "monnaieRembourse", 0,
                "produitsSelectionnes", List.of(Map.of("id_stock", savedS6.getId(), "quantiteConditionnement", 1, "quantite", 1, "venteParConditionnement", true, "prix", 1000, "priceMode", "DETAIL"))
        );

        mockMvc.perform(post("/api/ventes/cash")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isBadRequest());

        Stock updated = stockRepository.findById(savedS6.getId()).orElseThrow();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(50);
    }
}
