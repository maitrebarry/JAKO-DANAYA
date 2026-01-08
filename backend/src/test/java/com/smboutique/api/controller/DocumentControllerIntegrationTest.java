package com.smboutique.api.controller;

import com.smboutique.api.model.Inventaire;
import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.InventaireRepository;
import com.smboutique.api.repository.MouvementRepository;
import com.smboutique.api.repository.BoutiqueRepository;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.repository.PermissionRepository;
import com.smboutique.api.service.PdfService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class DocumentControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private InventaireRepository inventaireRepository;

    @Autowired
    private BoutiqueRepository boutiqueRepository;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private PermissionRepository permissionRepository;

    @Autowired
    private MouvementRepository mouvementRepository;

    @MockBean
    private PdfService pdfService;

    @Autowired
    private com.smboutique.api.repository.CaisseTransactionRepository caisseTransactionRepository;

    @Autowired
    private com.smboutique.api.repository.CommandeFournisseurRepository commandeFournisseurRepository;

    @Autowired
    private com.smboutique.api.repository.CommandeClientRepository commandeClientRepository;

    private Utilisateur user;
    private Boutique boutique;

    @BeforeEach
    void setUp() throws Exception {
        user = new Utilisateur();
        user.setEmail("doc-user@example.com");
        user = utilisateurRepository.save(user);

        boutique = new Boutique();
        boutique.setNom("DOC-TEST-BOUTIQUE");
        boutique = boutiqueRepository.save(boutique);

        user.setBoutique(boutique);
        user = utilisateurRepository.save(user);

        // ensure permission exists and is assigned
        var perm = permissionRepository.findByName("DOCUMENTS_TELECHARGER").orElseGet(() -> {
            var p = new com.smboutique.api.model.Permission();
            p.setName("DOCUMENTS_TELECHARGER");
            p.setDescription("Télécharger les documents");
            return permissionRepository.save(p);
        });
        user.setPermissions(new java.util.HashSet<>(java.util.Set.of(perm)));
        user = utilisateurRepository.save(user);

        // Make pdfService do a simple, safe write so controller flow continues
        doAnswer(invocation -> {
            Long id = invocation.getArgument(0);
            HttpServletResponse resp = invocation.getArgument(1);
            resp.setContentType("application/pdf");
            resp.getOutputStream().write("%PDF-1.4\n%TESTPDF\n".getBytes(StandardCharsets.UTF_8));
            resp.getOutputStream().flush();
            return null;
        }).when(pdfService).writeInventairePdf(eq(1L), any(HttpServletResponse.class));
        // For other ids default behavior: write simple bytes
        doAnswer(invocation -> {
            HttpServletResponse resp = invocation.getArgument(1);
            resp.setContentType("application/pdf");
            resp.getOutputStream().write("%PDF-1.4\n%TESTPDF\n".getBytes(StandardCharsets.UTF_8));
            resp.getOutputStream().flush();
            return null;
        }).when(pdfService).writeInventairePdf(any(Long.class), any(HttpServletResponse.class));

        // mock the caisse transaction pdf writer
        doAnswer(invocation -> {
            HttpServletResponse resp = invocation.getArgument(1);
            resp.setContentType("application/pdf");
            resp.getOutputStream().write("%PDF-1.4\n%TESTPDF-CAISSE\n".getBytes(StandardCharsets.UTF_8));
            resp.getOutputStream().flush();
            return null;
        }).when(pdfService).writeCaisseTransactionPdf(any(Long.class), any(HttpServletResponse.class));

        // mock commandes pdf writers
        doAnswer(invocation -> {
            HttpServletResponse resp = invocation.getArgument(1);
            resp.setContentType("application/pdf");
            resp.getOutputStream().write("%PDF-1.4\n%TESTPDF-CMD-FOURN\n".getBytes(StandardCharsets.UTF_8));
            resp.getOutputStream().flush();
            return null;
        }).when(pdfService).writeCommandePdf(any(Long.class), any(HttpServletResponse.class));

        doAnswer(invocation -> {
            HttpServletResponse resp = invocation.getArgument(1);
            resp.setContentType("application/pdf");
            resp.getOutputStream().write("%PDF-1.4\n%TESTPDF-CMD-CLIENT\n".getBytes(StandardCharsets.UTF_8));
            resp.getOutputStream().flush();
            return null;
        }).when(pdfService).writeCommandeClientPdf(any(Long.class), any(HttpServletResponse.class));
    }

    @Test
    void downloadInventaireCreatesMouvementAudit() throws Exception {
        Inventaire inv = new Inventaire();
        inv.setBoutique(boutique);
        inv.setReference("INV-TEST-001");
        inv = inventaireRepository.save(inv);

        mockMvc.perform(get("/api/documents/inventaire/" + inv.getId() + "/download").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("DOCUMENTS_TELECHARGER")))
                        .param("format", "pdf")
                        .contentType(MediaType.APPLICATION_PDF))
                .andExpect(status().isOk());

        List<com.smboutique.api.model.Mouvement> mouvements = mouvementRepository.findAll();
        com.smboutique.api.model.Mouvement found = null;
        for (com.smboutique.api.model.Mouvement mv : mouvements) {
            if (mv.getReferenceId() != null && mv.getReferenceId().equals(inv.getId())) {
                found = mv; break;
            }
        }
        assertThat(found).isNotNull();
        assertThat(found.getTypeMouvement()).isEqualTo("DOCUMENT");
        assertThat(found.getSousType()).isEqualTo("INVENTAIRE_PDF");
    }

    @Test
    void downloadCaisseTransactionWithoutPaiementCreatesMouvementAudit() throws Exception {
        // create a caisse transaction without linked paiement
        com.smboutique.api.model.CaisseTransaction tx = new com.smboutique.api.model.CaisseTransaction();
        tx.setBoutiqueId(boutique.getId());
        tx.setMontant(12345);
        tx.setReferenceCaisse("CAISSE-REF-001");
        tx.setRaison("Test transaction");
        tx = caisseTransactionRepository.save(tx);

        mockMvc.perform(get("/api/documents/caisse/" + tx.getId() + "/download").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("DOCUMENTS_TELECHARGER")))
                        .param("format", "pdf")
                        .contentType(MediaType.APPLICATION_PDF))
                .andExpect(status().isOk());

        List<com.smboutique.api.model.Mouvement> mouvements = mouvementRepository.findAll();
        com.smboutique.api.model.Mouvement found = null;
        for (com.smboutique.api.model.Mouvement mv : mouvements) {
            if (mv.getReferenceId() != null && mv.getReferenceId().equals(tx.getId())) {
                found = mv; break;
            }
        }
        assertThat(found).isNotNull();
        assertThat(found.getTypeMouvement()).isEqualTo("DOCUMENT");
        assertThat(found.getSousType()).isEqualTo("CAISSE_PDF");
        assertThat(found.getMontant()).isEqualTo(12345);
    }

    @Test
    void listDocumentsContainsCommandesAndUrls() throws Exception {
        // create command entries
        com.smboutique.api.model.CommandeFournisseur cf = new com.smboutique.api.model.CommandeFournisseur();
        cf.setBoutique(boutique);
        cf.setReference("CF-TEST-001");
        cf.setDateCommande(java.time.OffsetDateTime.now().toLocalDateTime());
        cf = commandeFournisseurRepository.save(cf);

        com.smboutique.api.model.CommandeClient cc = new com.smboutique.api.model.CommandeClient();
        cc.setBoutique(boutique);
        cc.setReference("CC-TEST-001");
        cc.setDateCommande(java.time.OffsetDateTime.now().toLocalDateTime());
        cc = commandeClientRepository.save(cc);

        String resp = mockMvc.perform(get("/api/documents").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("DOCUMENTS_VOIR"))).param("boutique", String.valueOf(boutique.getId())).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertThat(resp).contains("COMMANDE_FOURNISSEUR");
        assertThat(resp).contains("COMMANDE_CLIENT");
        assertThat(resp).contains("/api/documents/commande-fournisseur/" + cf.getId() + "/preview");
        assertThat(resp).contains("/api/documents/commande-client/" + cc.getId() + "/preview");
    }

    @Test
    void downloadCommandeFournisseurCreatesMouvementAudit() throws Exception {
        com.smboutique.api.model.CommandeFournisseur cf = new com.smboutique.api.model.CommandeFournisseur();
        cf.setBoutique(boutique);
        cf.setReference("CF-TEST-002");
        cf.setDateCommande(java.time.OffsetDateTime.now().toLocalDateTime());
        cf = commandeFournisseurRepository.save(cf);
        final Long cfId = cf.getId();

        mockMvc.perform(get("/api/documents/commande-fournisseur/" + cfId + "/download").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("DOCUMENTS_TELECHARGER"))).param("format", "pdf").contentType(MediaType.APPLICATION_PDF)).andExpect(status().isOk());

        List<com.smboutique.api.model.Mouvement> mouvements = mouvementRepository.findAll();
        com.smboutique.api.model.Mouvement found = mouvements.stream().filter(mv -> mv.getReferenceId() != null && mv.getReferenceId().equals(cfId) && "COMMANDE_FOURNISSEUR_PDF".equals(mv.getSousType())).findFirst().orElse(null);
        assertThat(found).isNotNull();
    }

    @Test
    void downloadCommandeClientCreatesMouvementAudit() throws Exception {
        com.smboutique.api.model.CommandeClient cc = new com.smboutique.api.model.CommandeClient();
        cc.setBoutique(boutique);
        cc.setReference("CC-TEST-002");
        cc.setDateCommande(java.time.OffsetDateTime.now().toLocalDateTime());
        cc = commandeClientRepository.save(cc);
        final Long ccId = cc.getId();

        mockMvc.perform(get("/api/documents/commande-client/" + ccId + "/download").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(user.getEmail()).authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("DOCUMENTS_TELECHARGER"))).param("format", "pdf").contentType(MediaType.APPLICATION_PDF)).andExpect(status().isOk());

        List<com.smboutique.api.model.Mouvement> mouvements = mouvementRepository.findAll();
        com.smboutique.api.model.Mouvement found = mouvements.stream().filter(mv -> mv.getReferenceId() != null && mv.getReferenceId().equals(ccId) && "COMMANDE_CLIENT_PDF".equals(mv.getSousType())).findFirst().orElse(null);
        assertThat(found).isNotNull();
    }

}
