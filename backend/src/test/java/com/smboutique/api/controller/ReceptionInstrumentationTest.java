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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class ReceptionInstrumentationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private BoutiqueRepository boutiqueRepository;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private CommandeFournisseurRepository commandeFournisseurRepository;

    @Autowired
    private MouvementRepository mouvementRepository;

    private Boutique boutique;
    private Utilisateur user;
    private CommandeFournisseur commande;

    @BeforeEach
    void setUp() {
        boutique = new Boutique();
        boutique.setNom("B1");
        boutique = boutiqueRepository.save(boutique);

        user = new Utilisateur();
        user.setEmail("rec@b1.local");
        user.setBoutique(boutique);
        Permission p = permissionRepository.findByName("RECEPTION_ECRITURE").orElseGet(() -> { Permission x = new Permission(); x.setName("RECEPTION_ECRITURE"); return permissionRepository.save(x); });
        user.setPermissions(java.util.Set.of(p));
        user = utilisateurRepository.save(user);

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user.getEmail(), "na"));

        commande = new CommandeFournisseur();
        commande.setReference("CMD-1");
        commande.setBoutique(boutique);
        commande.setTotal(1000);
        commande = commandeFournisseurRepository.save(commande);
    }

    @Test
    void createReception_creates_mouvement() throws Exception {
        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("idCommandeFournisseur", commande.getId());
        payload.put("reference", "R-1");
        payload.put("lignesReception", java.util.List.of());

        String resp = mockMvc.perform(post("/api/receptions/create")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        java.util.Map map = objectMapper.readValue(resp, java.util.Map.class);
        assertThat(map.get("id")).isNotNull();
        Integer idRec = (Integer) map.get("id");

        // search mouvements for user
        java.util.List<Mouvement> mvts = mouvementRepository.findAll().stream().filter(m -> m.getUtilisateur() != null && m.getUtilisateur().getId() != null && m.getUtilisateur().getId().equals(user.getId())).toList();
        assertThat(mvts).isNotEmpty();
        boolean found = mvts.stream().anyMatch(m -> "RECEPTION".equals(m.getTypeMouvement()) && "CREATION".equals(m.getSousType()) && m.getReferenceId() != null && m.getReferenceId().equals(idRec.longValue()));
        assertThat(found).isTrue();
    }
}