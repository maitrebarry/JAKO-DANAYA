package com.smboutique.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smboutique.api.model.Mouvement;
import com.smboutique.api.model.Permission;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.MouvementRepository;
import com.smboutique.api.repository.PermissionRepository;
import com.smboutique.api.repository.UtilisateurRepository;
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

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class MouvementControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MouvementRepository mouvementRepository;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    @Autowired
    private com.smboutique.api.repository.ProduitRepository produitRepository;

    @Autowired
    private com.smboutique.api.repository.StockRepository stockRepository;

    @Autowired
    private org.springframework.context.ApplicationContext applicationContext;

    private Utilisateur user1;
    private Utilisateur user2;

    @BeforeEach
    void setUp() {
        user1 = new Utilisateur();
        user1.setEmail("u1@example.com");
        user1 = utilisateurRepository.save(user1);

        user2 = new Utilisateur();
        user2.setEmail("u2@example.com");
        user2 = utilisateurRepository.save(user2);

        // create boutiques and assign users
        com.smboutique.api.model.Boutique b1 = new com.smboutique.api.model.Boutique();
        b1.setNom("BOCOUM-SERVICE");
        b1 = boutiqueRepository.save(b1);
        user1.setBoutique(b1);
        user1 = utilisateurRepository.save(user1);

        com.smboutique.api.model.Boutique b2 = new com.smboutique.api.model.Boutique();
        b2.setNom("MAKAN-SERVICE");
        b2 = boutiqueRepository.save(b2);
        user2.setBoutique(b2);
        user2 = utilisateurRepository.save(user2);

        // create 30 mouvements for user1 (boutique b1) and 5 for user2 (boutique b2)
        for (int i = 0; i < 30; i++) {
            Mouvement m = new Mouvement();
            m.setDateMouvement(LocalDateTime.now().minusMinutes(i));
            m.setTypeMouvement("TEST");
            m.setSousType("A");
            m.setDescription("u1-m" + i);
            m.setUtilisateur(user1);
            m.setBoutique(b1);
            mouvementRepository.save(m);
        }
        for (int i = 0; i < 5; i++) {
            Mouvement m = new Mouvement();
            m.setDateMouvement(LocalDateTime.now().minusMinutes(100 + i));
            m.setTypeMouvement("TEST");
            m.setSousType("B");
            m.setDescription("u2-m" + i);
            m.setUtilisateur(user2);
            m.setBoutique(b2);
            mouvementRepository.save(m);
        }

        // set authenticated user to user1 by default
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user1.getEmail(), "na"));
    }

    @Test
    void nonAuditorSeesOnlyOwnMovements() throws Exception {
        String resp = mockMvc.perform(get("/api/mouvements/search").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        java.util.List<java.util.Map> arr = objectMapper.readValue(resp, java.util.List.class);
        // with initial data we expect multiple for user1
        assertThat(arr).isNotEmpty();
        // all returned mouvements must belong to user1's boutique
        assertThat(arr.stream().allMatch(a -> {
            Object b = a.get("boutique");
            if (b == null) return false;
            Number bid = ((java.util.Map)b).get("id") != null ? (Number)((java.util.Map)b).get("id") : null;
            return bid != null && bid.longValue() == user1.getBoutique().getId();
        })).isTrue();

        // also check date format for first element (dd/MM/yyyy HH:mm:ss)
        java.util.Map first = arr.get(0);
        Object dateObj = first.get("dateMouvement");
        assertThat(dateObj).isInstanceOf(String.class);
        String dateStr = (String) dateObj;
        assertThat(dateStr).matches("\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}:\\d{2}");
    }

    @Test
    void nonAuditorCannotQueryOthers() throws Exception {
        mockMvc.perform(get("/api/mouvements/search?userId=" + user2.getId()).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isForbidden());
    }

    @Test
    void auditorCanQueryOthersWithPagination() throws Exception {
        Permission p = permissionRepository.findByName("MOUVEMENT_AUDIT").orElseGet(() -> permissionRepository.save(new Permission() {{ setName("MOUVEMENT_AUDIT"); setDescription("audit"); }}));
        user1.setPermissions(new java.util.HashSet<>(java.util.Set.of(p)));
        user1 = utilisateurRepository.save(user1);

        String resp = mockMvc.perform(get("/api/mouvements/search?userId=" + user2.getId() + "&page=1&size=2").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        java.util.Map map = objectMapper.readValue(resp, java.util.Map.class);
        assertThat(((Number)map.get("total")).intValue()).isEqualTo(5);
        java.util.List items = (java.util.List) map.get("items");
        assertThat(items.size()).isEqualTo(2);

        // test export for user2 by auditor
        String csv = mockMvc.perform(get("/api/mouvements/export?userId=" + user2.getId()).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Content-Type", org.hamcrest.Matchers.containsString("text/csv")))
                .andReturn().getResponse().getContentAsString();

        // header + 5 lines = 6 lines
        String[] lines = csv.split("\r?\n");
        // Check header and count; header uses French labels and dates should be dd/MM/yyyy HH:mm:ss
        assertThat(lines[0]).contains("Date,Type,Sous-type");
        assertThat(lines.length).isEqualTo(6);
        // verify date format on first data line
        String firstData = lines[1];
        // first column is Date, ensure it matches dd/MM/yyyy HH:mm:ss
        String firstDate = firstData.split(",")[0].replaceAll("\"", "");
        assertThat(firstDate).matches("\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}:\\d{2}");
    }

    @Test
    void auditorDefaultsToOwnBoutiqueWhenNoFilter() throws Exception {
        Permission p = permissionRepository.findByName("MOUVEMENT_AUDIT").orElseGet(() -> permissionRepository.save(new Permission() {{ setName("MOUVEMENT_AUDIT"); setDescription("audit"); }}));
        user1.setPermissions(new java.util.HashSet<>(java.util.Set.of(p)));
        user1 = utilisateurRepository.save(user1);

        // create mouvements in a different boutique and ensure auditor without explicit filter sees only own boutique
        com.smboutique.api.model.Boutique other = new com.smboutique.api.model.Boutique();
        other.setNom("OTHER");
        other = boutiqueRepository.save(other);

        Mouvement m = new Mouvement();
        m.setDateMouvement(LocalDateTime.now());
        m.setTypeMouvement("TEST");
        m.setDescription("other-boutique");
        m.setBoutique(other);
        mouvementRepository.save(m);

        final Long otherId = other.getId();

        String resp = mockMvc.perform(get("/api/mouvements/search?page=1&size=50").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        java.util.Map map = objectMapper.readValue(resp, java.util.Map.class);
        java.util.List<java.util.Map> arr = (java.util.List<java.util.Map>) map.get("items");
        assertThat(arr).isNotEmpty();
        // none of returned mouvements should have boutique id of the other
        assertThat(arr.stream().noneMatch(a -> {
            Object b = a.get("boutique");
            if (b == null) return false;
            Number bid = ((java.util.Map)b).get("id") != null ? (Number)((java.util.Map)b).get("id") : null;
            return bid != null && bid.longValue() == otherId.longValue();
        })).isTrue();
    }

    @Test
    void ownerCanSeeWorkerCaisseSummary() throws Exception {
        // make user1 an owner and user2 an employee in the same boutique
        user1.setTypeUtilisateur("PROPRIETAIRE");
        user1 = utilisateurRepository.save(user1);
        // ensure user2 is in same boutique
        user2.setBoutique(user1.getBoutique());
        user2 = utilisateurRepository.save(user2);

        // create mouvements for user2: +1000 and -200
        Mouvement en = new Mouvement();
        en.setDateMouvement(LocalDateTime.now());
        en.setTypeMouvement("CAISSE");
        en.setSousType("ENTREE");
        en.setMontant(1000);
        en.setUtilisateur(user2);
        en.setBoutique(user1.getBoutique());
        mouvementRepository.save(en);

        Mouvement out = new Mouvement();
        out.setDateMouvement(LocalDateTime.now());
        out.setTypeMouvement("CAISSE");
        out.setSousType("SORTIE");
        out.setMontant(-200);
        out.setUtilisateur(user2);
        out.setBoutique(user1.getBoutique());
        mouvementRepository.save(out);

        String resp = mockMvc.perform(get("/api/mouvements/reports/caisse/summary?period=day&userId=" + user2.getId()).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(resp);
        assertThat(node.get("totalEntrees").asLong()).isEqualTo(1000L);
        assertThat(node.get("totalSorties").asLong()).isEqualTo(200L);
        assertThat(node.get("net").asLong()).isEqualTo(800L);
    }

    @Test
    void ownerCannotSeeOtherBoutiqueWorkerSummary() throws Exception {
        // make user1 an owner
        user1.setTypeUtilisateur("PROPRIETAIRE");
        user1 = utilisateurRepository.save(user1);

        // create external worker in another boutique
        com.smboutique.api.model.Boutique other = new com.smboutique.api.model.Boutique();
        other.setNom("OTHER");
        other = boutiqueRepository.save(other);

        Utilisateur external = new Utilisateur();
        external.setEmail("ext@example.com");
        external.setBoutique(other);
        external = utilisateurRepository.save(external);

        String resp = mockMvc.perform(get("/api/mouvements/reports/caisse/summary?period=day&userId=" + external.getId()).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isForbidden())
                .andReturn().getResponse().getContentAsString();
    }

    @Test
    void createUtilisation_requiresPermissionAndUpdatesStock() throws Exception {
        // prepare a product and a boutique-level stock for user1
        com.smboutique.api.model.Produit produit = new com.smboutique.api.model.Produit();
        produit.setNomProduit("TEST-P");
        produit = produitRepository.save(produit);

        com.smboutique.api.model.Stock stock = new com.smboutique.api.model.Stock();
        stock.setProduit(produit);
        stock.setBoutique(user1.getBoutique());
        stock.setQuantiteDisponible(10);
        stock = stockRepository.save(stock);


        // attempt to create utilisation without permission -> forbidden
        com.smboutique.api.dto.UtilisationRequest req = new com.smboutique.api.dto.UtilisationRequest(produit.getId(), null, 3, "UTILISATION", "Test util");
        String body = objectMapper.writeValueAsString(req);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/mouvements/utilisations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isForbidden());

        // grant permission and retry
        com.smboutique.api.model.Permission p = permissionRepository.findByName("UTILISA_PERTE_CREER").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission();
            perm.setName("UTILISA_PERTE_CREER");
            perm.setDescription("create utilisation/perte");
            return permissionRepository.save(perm);
        });
        user1.setPermissions(new java.util.HashSet<>(java.util.Set.of(p)));
        user1 = utilisateurRepository.save(user1);

        String resp = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/mouvements/utilisations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        java.util.Map map = objectMapper.readValue(resp, java.util.Map.class);
        assertThat(map.get("typeMouvement")).isEqualTo("UTILISATION");
        assertThat(((Number)map.get("quantite")).intValue()).isEqualTo(3);

        // verify stock decreased
        com.smboutique.api.model.Stock updated = stockRepository.findById(stock.getId()).orElse(null);
        assertThat(updated).isNotNull();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(7);

        // verify an UtilisationPertes record was created and linked
        com.smboutique.api.repository.UtilisationPertesRepository upr = (com.smboutique.api.repository.UtilisationPertesRepository) applicationContext.getBean(com.smboutique.api.repository.UtilisationPertesRepository.class);
        java.util.List<com.smboutique.api.model.UtilisationPertes> ups = upr.findAll();
        assertThat(ups).isNotEmpty();
        com.smboutique.api.model.UtilisationPertes up = ups.get(ups.size()-1);
        assertThat(up.getQuantite()).isEqualTo(3);
        assertThat(up.getProduit().getId()).isEqualTo(produit.getId());
    }

    @Test
    void createUtilisation_cannotExceedStock() throws Exception {
        com.smboutique.api.model.Produit produit = new com.smboutique.api.model.Produit();
        produit.setNomProduit("TEST-P2");
        produit = produitRepository.save(produit);

        com.smboutique.api.model.Stock stock = new com.smboutique.api.model.Stock();
        stock.setProduit(produit);
        stock.setBoutique(user1.getBoutique());
        stock.setQuantiteDisponible(2);
        stock = stockRepository.save(stock);


        com.smboutique.api.model.Permission p = permissionRepository.findByName("UTILISA_PERTE_CREER").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission();
            perm.setName("UTILISA_PERTE_CREER");
            perm.setDescription("create utilisation/perte");
            return permissionRepository.save(perm);
        });
        user1.setPermissions(new java.util.HashSet<>(java.util.Set.of(p)));
        user1 = utilisateurRepository.save(user1);

        com.smboutique.api.dto.UtilisationRequest req = new com.smboutique.api.dto.UtilisationRequest(produit.getId(), null, 5, "PERTE", "Too many");
        String body = objectMapper.writeValueAsString(req);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/mouvements/utilisations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deleteUtilisation_restoresStock() throws Exception {
        // prepare product and stock
        com.smboutique.api.model.Produit produit = new com.smboutique.api.model.Produit();
        produit.setNomProduit("DEL-P");
        produit = produitRepository.save(produit);

        com.smboutique.api.model.Stock stock = new com.smboutique.api.model.Stock();
        stock.setProduit(produit);
        stock.setBoutique(user1.getBoutique());
        stock.setQuantiteDisponible(10);
        stock = stockRepository.save(stock);

        // grant create and delete permissions
        com.smboutique.api.model.Permission pCreate = permissionRepository.findByName("UTILISA_PERTE_CREER").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission();
            perm.setName("UTILISA_PERTE_CREER");
            perm.setDescription("create utilisation/perte");
            return permissionRepository.save(perm);
        });
        com.smboutique.api.model.Permission pDelete = permissionRepository.findByName("UTILISA_PERTE_SUPPRIMER").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission();
            perm.setName("UTILISA_PERTE_SUPPRIMER");
            perm.setDescription("delete utilisation/perte");
            return permissionRepository.save(perm);
        });
        user1.setPermissions(new java.util.HashSet<>(java.util.Set.of(pCreate, pDelete)));
        user1 = utilisateurRepository.save(user1);

        // create utilisation of quantity 4
        com.smboutique.api.dto.UtilisationRequest req = new com.smboutique.api.dto.UtilisationRequest(produit.getId(), null, 4, "UTILISATION", "To delete");
        String body = objectMapper.writeValueAsString(req);

        String resp = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/mouvements/utilisations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        java.util.Map map = objectMapper.readValue(resp, java.util.Map.class);
        Number mvId = (Number) map.get("id");
        assertThat(((Number)map.get("quantite")).intValue()).isEqualTo(4);

        // stock should have decreased to 6
        com.smboutique.api.model.Stock updated = stockRepository.findById(stock.getId()).orElse(null);
        assertThat(updated).isNotNull();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(6);

        // delete mouvement
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/mouvements/" + mvId.longValue())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk());

        // stock should be restored to 10
        com.smboutique.api.model.Stock restored = stockRepository.findById(stock.getId()).orElse(null);
        assertThat(restored).isNotNull();
        assertThat(restored.getQuantiteDisponible()).isEqualTo(10);

        // utilisation_pertes record should be deleted
        com.smboutique.api.repository.UtilisationPertesRepository upr = (com.smboutique.api.repository.UtilisationPertesRepository) applicationContext.getBean(com.smboutique.api.repository.UtilisationPertesRepository.class);
        java.util.List<com.smboutique.api.model.UtilisationPertes> ups = upr.findAll();
        // ensure no record references the deleted mouvement id
        assertThat(ups.stream().noneMatch(u -> u.getMouvementId() != null && u.getMouvementId().equals(mvId.longValue()))).isTrue();
    }

    @Test
    void updateUtilisation_adjustsStockAndUtilisationPertes() throws Exception {
        // prepare product and stock
        com.smboutique.api.model.Produit produit = new com.smboutique.api.model.Produit();
        produit.setNomProduit("UPD-P");
        produit = produitRepository.save(produit);

        com.smboutique.api.model.Stock stock = new com.smboutique.api.model.Stock();
        stock.setProduit(produit);
        stock.setBoutique(user1.getBoutique());
        stock.setQuantiteDisponible(10);
        stock = stockRepository.save(stock);

        // grant create and modify permissions
        com.smboutique.api.model.Permission pCreate = permissionRepository.findByName("UTILISA_PERTE_CREER").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission();
            perm.setName("UTILISA_PERTE_CREER");
            perm.setDescription("create utilisation/perte");
            return permissionRepository.save(perm);
        });
        com.smboutique.api.model.Permission pMod = permissionRepository.findByName("UTILISA_PERTE_MODIFIER").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission();
            perm.setName("UTILISA_PERTE_MODIFIER");
            perm.setDescription("modify utilisation/perte");
            return permissionRepository.save(perm);
        });
        user1.setPermissions(new java.util.HashSet<>(java.util.Set.of(pCreate, pMod)));
        user1 = utilisateurRepository.save(user1);

        // create utilisation of quantity 3
        com.smboutique.api.dto.UtilisationRequest req = new com.smboutique.api.dto.UtilisationRequest(produit.getId(), null, 3, "UTILISATION", "To update");
        String body = objectMapper.writeValueAsString(req);

        String resp = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/mouvements/utilisations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        java.util.Map map = objectMapper.readValue(resp, java.util.Map.class);
        Number mvId = (Number) map.get("id");
        assertThat(((Number)map.get("quantite")).intValue()).isEqualTo(3);

        // stock should have decreased to 7
        com.smboutique.api.model.Stock updated = stockRepository.findById(stock.getId()).orElse(null);
        assertThat(updated).isNotNull();
        assertThat(updated.getQuantiteDisponible()).isEqualTo(7);

        // increase utilisation quantity to 5
        com.smboutique.api.model.Mouvement updatePayload = new com.smboutique.api.model.Mouvement();
        updatePayload.setId(mvId.longValue());
        updatePayload.setQuantite(5);
        updatePayload.setProduit(produit);
        updatePayload.setMagasin(null);
        String updBody = objectMapper.writeValueAsString(updatePayload);

        String updResp = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/mouvements/" + mvId.longValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(updBody)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        java.util.Map updMap = objectMapper.readValue(updResp, java.util.Map.class);
        assertThat(((Number)updMap.get("quantite")).intValue()).isEqualTo(5);

        // stock should now be 5 (7 - 2)
        com.smboutique.api.model.Stock afterInc = stockRepository.findById(stock.getId()).orElse(null);
        assertThat(afterInc.getQuantiteDisponible()).isEqualTo(5);

        // utilisation_pertes should have updated quantity
        com.smboutique.api.repository.UtilisationPertesRepository upr = (com.smboutique.api.repository.UtilisationPertesRepository) applicationContext.getBean(com.smboutique.api.repository.UtilisationPertesRepository.class);
        java.util.List<com.smboutique.api.model.UtilisationPertes> ups = upr.findAll();
        com.smboutique.api.model.UtilisationPertes up = ups.stream().filter(u -> u.getMouvementId() != null && u.getMouvementId().equals(mvId.longValue())).findFirst().orElse(null);
        assertThat(up).isNotNull();
        assertThat(up.getQuantite()).isEqualTo(5);

        // decrease utilisation quantity to 2
        updatePayload.setQuantite(2);
        updBody = objectMapper.writeValueAsString(updatePayload);
        String decResp = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/mouvements/" + mvId.longValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(updBody)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        java.util.Map decMap = objectMapper.readValue(decResp, java.util.Map.class);
        assertThat(((Number)decMap.get("quantite")).intValue()).isEqualTo(2);

        // stock should now have increased by 3 -> 8
        com.smboutique.api.model.Stock afterDec = stockRepository.findById(stock.getId()).orElse(null);
        assertThat(afterDec.getQuantiteDisponible()).isEqualTo(8);
    }

    @Test
    void listUtilisations_fallsBackToUtilisationPertesQuantityIfMouvementMissingQuantite() throws Exception {
        // create a product and a mouvement with null quantity
        com.smboutique.api.model.Produit produit = new com.smboutique.api.model.Produit();
        produit.setNomProduit("FALLBACK-P");
        produit = produitRepository.save(produit);

        com.smboutique.api.model.Mouvement m = new com.smboutique.api.model.Mouvement();
        m.setProduit(produit);
        m.setTypeMouvement("UTILISATION");
        m.setDateMouvement(java.time.LocalDateTime.now());
        m.setDescription("fallback test");
        m.setBoutique(user1.getBoutique());
        // intentionally leave quantite null
        m = mouvementRepository.save(m);

        // create utilisation_pertes pointing to this mouvement
        com.smboutique.api.model.UtilisationPertes up = new com.smboutique.api.model.UtilisationPertes();
        up.setMouvementId(m.getId());
        up.setQuantite(25);
        up.setProduit(produit);
        up.setType("UTILISATION");
        up.setDate(java.time.LocalDate.now());
        com.smboutique.api.repository.UtilisationPertesRepository upr = (com.smboutique.api.repository.UtilisationPertesRepository) applicationContext.getBean(com.smboutique.api.repository.UtilisationPertesRepository.class);
        upr.save(up);

        final long mid = m.getId();

        // grant read permission
        com.smboutique.api.model.Permission p = permissionRepository.findByName("UTILISA_PERTE_VOIR").orElseGet(() -> { com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission(); perm.setName("UTILISA_PERTE_VOIR"); perm.setDescription("voir utilisations"); return permissionRepository.save(perm); });
        user1.setPermissions(new java.util.HashSet<>(java.util.Set.of(p)));
        user1 = utilisateurRepository.save(user1);

        String resp = mockMvc.perform(get("/api/mouvements/utilisations").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        java.util.List<java.util.Map> arr = objectMapper.readValue(resp, java.util.List.class);
        java.util.Map found = arr.stream().filter(a -> ((Number)a.get("id")).longValue() == mid).findFirst().orElse(null);
        assertThat(found).isNotNull();
        assertThat(((Number)found.get("quantite")).intValue()).isEqualTo(25);
    }

    @Test
    void createViaUtilisationPertes_createsMouvementAndDecrementsStock() throws Exception {
        com.smboutique.api.model.Produit produit = new com.smboutique.api.model.Produit();
        produit.setNomProduit("UP-P");
        produit = produitRepository.save(produit);

        com.smboutique.api.model.Stock stock = new com.smboutique.api.model.Stock();
        stock.setProduit(produit);
        stock.setBoutique(user1.getBoutique());
        stock.setQuantiteDisponible(8);
        stock = stockRepository.save(stock);

        com.smboutique.api.model.Permission p = permissionRepository.findByName("UTILISA_PERTE_CREER").orElseGet(() -> {
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission(); perm.setName("UTILISA_PERTE_CREER"); perm.setDescription("create utilisation/perte"); return permissionRepository.save(perm);
        });
        user1.setPermissions(new java.util.HashSet<>(java.util.Set.of(p)));
        user1 = utilisateurRepository.save(user1);

        com.smboutique.api.model.UtilisationPertes up = new com.smboutique.api.model.UtilisationPertes();
        up.setMotif("created via controller");
        up.setQuantite(3);
        up.setType("UTILISATION");
        up.setProduit(produit);

        String body = objectMapper.writeValueAsString(up);

        String resp = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/utilisation-pertes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        com.smboutique.api.model.UtilisationPertes saved = objectMapper.readValue(resp, com.smboutique.api.model.UtilisationPertes.class);
        assertThat(saved.getQuantite()).isEqualTo(3);
        assertThat(saved.getProduit().getId()).isEqualTo(produit.getId());

        // mouvement must have been created and linked
        com.smboutique.api.model.Mouvement m = mouvementRepository.findById(saved.getMouvementId()).orElse(null);
        assertThat(m).isNotNull();
        assertThat(m.getQuantite()).isEqualTo(3);

        // stock decreased by 3
        com.smboutique.api.model.Stock updated = stockRepository.findById(stock.getId()).orElse(null);
        assertThat(updated.getQuantiteDisponible()).isEqualTo(5);
    }

    @Test
    void updateViaUtilisationPertes_updatesMouvementAndAdjustsStock() throws Exception {
        com.smboutique.api.model.Produit produit = new com.smboutique.api.model.Produit();
        produit.setNomProduit("UPD-P2");
        produit = produitRepository.save(produit);

        com.smboutique.api.model.Stock stock = new com.smboutique.api.model.Stock();
        stock.setProduit(produit);
        stock.setBoutique(user1.getBoutique());
        stock.setQuantiteDisponible(20);
        stock = stockRepository.save(stock);

        com.smboutique.api.model.Permission pCreate = permissionRepository.findByName("UTILISA_PERTE_CREER").orElseGet(() -> { com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission(); perm.setName("UTILISA_PERTE_CREER"); perm.setDescription("create utilisation/perte"); return permissionRepository.save(perm); });
        com.smboutique.api.model.Permission pMod = permissionRepository.findByName("UTILISA_PERTE_MODIFIER").orElseGet(() -> { com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission(); perm.setName("UTILISA_PERTE_MODIFIER"); perm.setDescription("modify utilisation/perte"); return permissionRepository.save(perm); });
        user1.setPermissions(new java.util.HashSet<>(java.util.Set.of(pCreate, pMod)));
        user1 = utilisateurRepository.save(user1);

        // create initial utilisation via controller
        com.smboutique.api.model.UtilisationPertes up = new com.smboutique.api.model.UtilisationPertes();
        up.setMotif("create then update"); up.setQuantite(5); up.setType("UTILISATION"); up.setProduit(produit);
        String body = objectMapper.writeValueAsString(up);
        String resp = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/utilisation-pertes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        com.smboutique.api.model.UtilisationPertes saved = objectMapper.readValue(resp, com.smboutique.api.model.UtilisationPertes.class);
        assertThat(saved.getQuantite()).isEqualTo(5);

        com.smboutique.api.model.Stock afterCreate = stockRepository.findById(stock.getId()).orElse(null);
        assertThat(afterCreate.getQuantiteDisponible()).isEqualTo(15);

        // now update utilisation_pertes to increase to 8
        saved.setQuantite(8);
        String updBody = objectMapper.writeValueAsString(saved);
        String updResp = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/utilisation-pertes/" + saved.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content(updBody)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        com.smboutique.api.model.UtilisationPertes updated = objectMapper.readValue(updResp, com.smboutique.api.model.UtilisationPertes.class);
        assertThat(updated.getQuantite()).isEqualTo(8);

        // check movement updated
        com.smboutique.api.model.Mouvement m = mouvementRepository.findById(updated.getMouvementId()).orElse(null);
        assertThat(m.getQuantite()).isEqualTo(8);

        // stock should be 12 (20 - 8)
        com.smboutique.api.model.Stock afterUpd = stockRepository.findById(stock.getId()).orElse(null);
        assertThat(afterUpd.getQuantiteDisponible()).isEqualTo(12);
    }

    @Test
    void deleteViaUtilisationPertes_deletesMouvementAndRestoresStock() throws Exception {
        com.smboutique.api.model.Produit produit = new com.smboutique.api.model.Produit();
        produit.setNomProduit("DEL-P2");
        produit = produitRepository.save(produit);

        com.smboutique.api.model.Stock stock = new com.smboutique.api.model.Stock();
        stock.setProduit(produit);
        stock.setBoutique(user1.getBoutique());
        stock.setQuantiteDisponible(30);
        stock = stockRepository.save(stock);

        com.smboutique.api.model.Permission pCreate = permissionRepository.findByName("UTILISA_PERTE_CREER").orElseGet(() -> { com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission(); perm.setName("UTILISA_PERTE_CREER"); perm.setDescription("create utilisation/perte"); return permissionRepository.save(perm); });
        com.smboutique.api.model.Permission pDel = permissionRepository.findByName("UTILISA_PERTE_SUPPRIMER").orElseGet(() -> { com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission(); perm.setName("UTILISA_PERTE_SUPPRIMER"); perm.setDescription("delete utilisation/perte"); return permissionRepository.save(perm); });
        user1.setPermissions(new java.util.HashSet<>(java.util.Set.of(pCreate, pDel)));
        user1 = utilisateurRepository.save(user1);

        // create via controller
        com.smboutique.api.model.UtilisationPertes up = new com.smboutique.api.model.UtilisationPertes();
        up.setMotif("to delete"); up.setQuantite(6); up.setType("UTILISATION"); up.setProduit(produit);
        String body = objectMapper.writeValueAsString(up);
        String resp = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/utilisation-pertes")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        com.smboutique.api.model.UtilisationPertes saved = objectMapper.readValue(resp, com.smboutique.api.model.UtilisationPertes.class);
        com.smboutique.api.model.Mouvement m = mouvementRepository.findById(saved.getMouvementId()).orElse(null);
        assertThat(m).isNotNull();

        // delete via controller
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/utilisation-pertes/" + saved.getId())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user1.getEmail())))
                .andExpect(status().isOk());

        // mouvement should be deleted
        assertThat(mouvementRepository.findById(m.getId()).isEmpty()).isTrue();

        // stock should be restored to 30
        com.smboutique.api.model.Stock afterDel = stockRepository.findById(stock.getId()).orElse(null);
        assertThat(afterDel.getQuantiteDisponible()).isEqualTo(30);
    }
}