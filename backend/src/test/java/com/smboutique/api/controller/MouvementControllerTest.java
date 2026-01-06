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
}