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
public class VenteLivraisonControllerTest {

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
    private VenteRepository venteRepository;

    @Autowired
    private LigneVenteRepository ligneVenteRepository;

    @Autowired
    private LivraisonRepository livraisonRepository;

    @Autowired
    private LigneLivraisonRepository ligneLivraisonRepository;

    @Autowired
    private MouvementRepository mouvementRepository;

    private Boutique boutique;
    private Magasin magasin;
    private Utilisateur user;
    private Produit produit;
    private Stock stock;
    private Vente vente;
    private LigneVente ligneVente;

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
        produit = produitRepository.save(produit);

        stock = new Stock();
        stock.setProduit(produit);
        stock.setMagasin(magasin);
        stock.setQuantiteDisponible(10);
        stock.setCostAverage(new BigDecimal("50.00"));
        stock.setLastPurchasePrice(new BigDecimal("50.00"));
        stock = stockRepository.save(stock);

        user = new Utilisateur();
        user.setEmail("test@b1.local");
        user.setBoutique(boutique);
        // ensure permission exists and assign
        Permission p = new Permission();
        p.setName("LIVRAISON_ECRITURE");
        p = permissionRepository.save(p);
        user.setPermissions(java.util.Set.of(p));
        user = utilisateurRepository.save(user);

        // set authentication name to user's email
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user.getEmail(), "na"));

        vente = new Vente();
        vente.setNomClient("Client A");
        vente = venteRepository.save(vente);

        ligneVente = new LigneVente();
        ligneVente.setVente(vente);
        ligneVente.setProduit(produit);
        ligneVente.setQuantite(5);
        ligneVente.setNewPrice(2000);
        ligneVente.setPriceMode(null); // will set in test payload
        ligneVente = ligneVenteRepository.save(ligneVente);
    }

    @Test
    void deliverVente_success_decrementsStock_createsMouvement_and_updatesLigneLivre() throws Exception {
        var payload = Map.of(
                "reference", "LV-TEST",
                "lignes", List.of(Map.of("ligneVenteId", ligneVente.getId(), "stockId", stock.getId(), "quantite", 3))
        );

        mockMvc.perform(post("/api/ventes/" + vente.getId() + "/livraisons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk());

        Stock updated = stockRepository.findById(stock.getId()).orElseThrow();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(7);

        List<Livraison> livs = livraisonRepository.findAll();
        assertThat(livs).isNotEmpty();

        List<LigneLivraison> lrs = ligneLivraisonRepository.findAll();
        assertThat(lrs).isNotEmpty();

        LigneVente lv = ligneVenteRepository.findById(ligneVente.getId()).orElseThrow();
        assertThat(lv.getQuantiteLivre()).isEqualTo(3);

        List<Mouvement> mvts = mouvementRepository.findAll();
        assertThat(mvts).isNotEmpty();
        Mouvement m = mvts.get(0);
        assertThat(m.getTypeMouvement()).isEqualTo("SORTIE");
        assertThat(m.getStock().getId()).isEqualTo(stock.getId());
        assertThat(m.getBoutique().getId()).isEqualTo(boutique.getId());

        // CMP unchanged
        Stock after = stockRepository.findById(stock.getId()).orElseThrow();
        assertThat(after.getCostAverage()).isEqualTo(new BigDecimal("50.00"));
        produit = produitRepository.findById(produit.getId()).orElseThrow();
        assertThat(produit.getPrixAchat()).isEqualTo(1000);
    }

    @Test
    void deliverVente_insufficientStock_rollback() throws Exception {
        var payload = Map.of(
                "reference", "LV-TEST",
                "lignes", List.of(Map.of("ligneVenteId", ligneVente.getId(), "stockId", stock.getId(), "quantite", 20))
        );

        mockMvc.perform(post("/api/ventes/" + vente.getId() + "/livraisons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isInternalServerError());

        // Verify rollback: stock unchanged, no livraison, no mouvement
        Stock updated = stockRepository.findById(stock.getId()).orElseThrow();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(10);
        assertThat(livraisonRepository.findAll()).isEmpty();
        assertThat(mouvementRepository.findAll()).isEmpty();
    }

    @Test
    void deliverVente_partialDelivery_allowed() throws Exception {
        var payload = Map.of(
                "reference", "LV-TEST",
                "lignes", List.of(Map.of("ligneVenteId", ligneVente.getId(), "stockId", stock.getId(), "quantite", 2))
        );

        mockMvc.perform(post("/api/ventes/" + vente.getId() + "/livraisons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk());

        LigneVente lv = ligneVenteRepository.findById(ligneVente.getId()).orElseThrow();
        assertThat(lv.getQuantiteLivre()).isEqualTo(2);
    }

    @Test
    void deliverVente_crossBoutique_forbidden() throws Exception {
        // create boutique2 and stock in it
        Boutique b2 = new Boutique(); b2.setNom("B2"); b2 = boutiqueRepository.save(b2);
        Magasin m2 = new Magasin(); m2.setNom("M2"); m2.setBoutique(b2); m2 = magasinRepository.save(m2);
        Stock s2 = new Stock(); s2.setProduit(produit); s2.setMagasin(m2); s2.setQuantiteDisponible(10); s2 = stockRepository.save(s2);

        var payload = Map.of(
                "reference", "LV-TEST",
                "lignes", List.of(Map.of("ligneVenteId", ligneVente.getId(), "stockId", s2.getId(), "quantite", 2))
        );

        mockMvc.perform(post("/api/ventes/" + vente.getId() + "/livraisons")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isInternalServerError());

        // ensure no change to s2
        Stock s2after = stockRepository.findById(s2.getId()).orElseThrow();
        assertThat(s2after.getQuantiteDisponible()).isEqualTo(10);
    }
}
