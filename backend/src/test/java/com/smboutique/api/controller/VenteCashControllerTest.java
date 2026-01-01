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
        stock.setMagasin(magasin);
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
        Vente v = ventes.get(0);
        assertThat(v.getMontantTotal()).isEqualTo(5000);

        List<LigneVente> lvs = ligneVenteRepository.findAll();
        assertThat(lvs).isNotEmpty();
        LigneVente lv = lvs.get(0);
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

        // CMP unchanged
        Stock after = stockRepository.findById(stock.getId()).orElseThrow();
        assertThat(after.getCostAverage()).isEqualTo(new BigDecimal("50.00"));
        produit = produitRepository.findById(produit.getId()).orElseThrow();
        assertThat(produit.getPrixAchat()).isEqualTo(1000);
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

        // Verify rollback: no vente persisted and stock unchanged
        assertThat(venteRepository.findAll()).isEmpty();
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
        s2.setMagasin(magasin);
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
        s3.setMagasin(magasin);
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

        Mouvement m = mouvementRepository.findAll().stream().filter(mt -> mt.getStock() != null && mt.getStock().getId().equals(savedS3.getId())).findFirst().orElseThrow();
        assertThat(m.getQuantite()).isEqualTo(real);
        assertThat(m.getMontant()).isEqualTo(real * prix);
    }
}
