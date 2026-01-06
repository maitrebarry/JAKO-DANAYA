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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class CommandeClientInstrumentationTest {

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
    private MouvementRepository mouvementRepository;

    @Autowired
    private CommandeClientRepository commandeClientRepository;

    @Autowired
    private CaisseRepository caisseRepository;

    @Autowired
    private PaiementClientRepository paiementClientRepository;

    private Boutique boutique;
    private Utilisateur user;

    @BeforeEach
    void setUp() {
        boutique = new Boutique();
        boutique.setNom("BC1");
        boutique = boutiqueRepository.save(boutique);

        user = new Utilisateur();
        user.setEmail("cc@bc1.local");
        user.setBoutique(boutique);
        Permission p1 = permissionRepository.findByName("PAIEMENT_CREER").orElseGet(() -> { Permission x = new Permission(); x.setName("PAIEMENT_CREER"); return permissionRepository.save(x); });
        Permission p2 = permissionRepository.findByName("COMMANDE_SUPPRIMER").orElseGet(() -> { Permission x = new Permission(); x.setName("COMMANDE_SUPPRIMER"); return permissionRepository.save(x); });
        user.setPermissions(java.util.Set.of(p1, p2));
        user = utilisateurRepository.save(user);

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user.getEmail(), "na"));
    }

    @Test
    void createCommande_creates_mouvement() throws Exception {
        CommandeClient payload = new CommandeClient();
        payload.setReference("CMD-C-1");
        payload.setBoutique(boutique);
        payload.setTotal(2000);

        String resp = mockMvc.perform(post("/api/commandes-clients")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(payload))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        CommandeClient created = objectMapper.readValue(resp, CommandeClient.class);
        assertThat(created.getId()).isNotNull();

        java.util.List<Mouvement> mvts = mouvementRepository.findAll().stream().filter(m -> m.getUtilisateur() != null && m.getUtilisateur().getId() != null && m.getUtilisateur().getId().equals(user.getId())).toList();
        assertThat(mvts).isNotEmpty();
        boolean found = mvts.stream().anyMatch(m -> "COMMANDE".equals(m.getTypeMouvement()) && "CREATION".equals(m.getSousType()) && m.getReferenceId() != null && m.getReferenceId().equals(created.getId()));
        assertThat(found).isTrue();
    }

    @Test
    void paiement_creates_mouvement() throws Exception {
        CommandeClient cmd = new CommandeClient();
        cmd.setReference("CMD-P-1");
        cmd.setBoutique(boutique);
        cmd.setTotal(1500);
        CommandeClient savedCmd = commandeClientRepository.save(cmd);

        // create an open caisse with a reference
        Caisse c = new Caisse();
        c.setReference("CAISSE-1");
        c.setBoutique(boutique);
        c.setMontantTotal(0);
        c.setStatut("OUVERTE");
        caisseRepository.save(c);

        java.util.Map<String, Object> pay = new java.util.HashMap<>();
        pay.put("montant", 500);
        pay.put("referenceCaisse", "CAISSE-1");

        String resp = mockMvc.perform(post("/api/commandes-clients/" + savedCmd.getId() + "/paiement")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(pay))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        CommandeClient updated = objectMapper.readValue(resp, CommandeClient.class);
        assertThat(updated.getPaie()).isEqualTo(500);

        java.util.List<Mouvement> mvts = mouvementRepository.findAll().stream().filter(m -> m.getUtilisateur() != null && m.getUtilisateur().getId() != null && m.getUtilisateur().getId().equals(user.getId())).toList();
        boolean found = mvts.stream().anyMatch(m -> "PAIEMENT".equals(m.getTypeMouvement()) && "COMMANDE_CLIENT".equals(m.getSousType()) && m.getReferenceId() != null && m.getReferenceId().equals(savedCmd.getId()) && m.getMontant() != null && m.getMontant().doubleValue() == 500.0);
        assertThat(found).isTrue();
    }

    @Test
    void deleteCommande_annuls_payments_and_logs() throws Exception {
        CommandeClient cmd = new CommandeClient();
        cmd.setReference("CMD-D-1");
        cmd.setBoutique(boutique);
        cmd.setTotal(800);
        CommandeClient savedCmd = commandeClientRepository.save(cmd);

        // create an open caisse and a payment
        Caisse c = new Caisse();
        c.setReference("C-DEL-1");
        c.setBoutique(boutique);
        c.setMontantTotal(0);
        c.setStatut("OUVERTE");
        caisseRepository.save(c);

        // create payment via controller endpoint (keeps logic consistent)
        java.util.Map<String, Object> pay = new java.util.HashMap<>();
        pay.put("montant", 300);
        pay.put("referenceCaisse", c.getReference());

        mockMvc.perform(post("/api/commandes-clients/" + savedCmd.getId() + "/paiement")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(pay))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk());

        // Now delete the commande
        mockMvc.perform(delete("/api/commandes-clients/" + savedCmd.getId())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail())))
                .andExpect(status().isOk());

        java.util.List<Mouvement> mvts = mouvementRepository.findAll().stream().filter(m -> m.getUtilisateur() != null && m.getUtilisateur().getId() != null && m.getUtilisateur().getId().equals(user.getId())).toList();
        boolean foundAnn = mvts.stream().anyMatch(m -> "PAIEMENT".equals(m.getTypeMouvement()) && "ANNULATION".equals(m.getSousType()) && m.getReferenceId() != null && m.getReferenceId().equals(savedCmd.getId()));
        boolean foundCmdDel = mvts.stream().anyMatch(m -> "COMMANDE".equals(m.getTypeMouvement()) && "SUPPRESSION".equals(m.getSousType()) && m.getReferenceId() != null && m.getReferenceId().equals(savedCmd.getId()));
        assertThat(foundAnn).isTrue();
        assertThat(foundCmdDel).isTrue();
    }
}
