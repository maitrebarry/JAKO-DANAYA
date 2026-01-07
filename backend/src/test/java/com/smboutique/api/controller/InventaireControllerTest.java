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
    private com.smboutique.api.repository.MouvementRepository mouvementRepository;

    @Autowired
    private com.smboutique.api.repository.UtilisateurRepository utilisateurRepository;

    @Autowired
    private com.smboutique.api.repository.PermissionRepository permissionRepository;

    private Utilisateur user;
    private Boutique boutique;
    private Produit produit;

    @BeforeEach
    void setUp() {
        user = new Utilisateur();
        user.setEmail("inv-user@example.com");
        user = utilisateurRepository.save(user);

        boutique = new Boutique();
        boutique.setNom("TEST-BOUTIQUE");
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

        mockMvc.perform(post("/api/inventaires/" + inv.getId() + "/lignes")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated());

        // Check saved ligne
        java.util.List<LigneInventaire> lignes = ligneInventaireRepository.findByInventaireId(inv.getId());
        assertThat(lignes).isNotEmpty();
        LigneInventaire saved = lignes.get(0);
        assertThat(saved.getQuantitePhysique()).isEqualTo(10 * 4 + 3);
    }
}
