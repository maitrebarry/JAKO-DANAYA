package com.smboutique.api.controller;

import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.service.PdfService;
import com.smboutique.api.service.MouvementService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.service.CommandeClientService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.mockito.Mockito.*;

public class CommandeClientControllerTest {
    private com.smboutique.api.controller.CommandeClientController controller;
    private CommandeClientService commandeClientService;
    private PdfService pdfService;
    private MouvementService mouvementService;
    private UtilisateurService utilisateurService;
    private HttpServletResponse response;

    @BeforeEach
    public void setup() {
        controller = new com.smboutique.api.controller.CommandeClientController();
        commandeClientService = mock(CommandeClientService.class);
        pdfService = mock(PdfService.class);
        mouvementService = mock(MouvementService.class);
        utilisateurService = mock(UtilisateurService.class);
        response = mock(HttpServletResponse.class);

        org.springframework.test.util.ReflectionTestUtils.setField(controller, "commandeClientService", commandeClientService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "pdfService", pdfService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "mouvementService", mouvementService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "utilisateurService", utilisateurService);
    }

    @Test
    public void testGetCommandeClientPdfLogsMouvementAsSuperAdmin() throws Exception {
        // Set auth as superadmin
        org.springframework.security.core.Authentication auth = mock(org.springframework.security.core.Authentication.class);
        when(auth.getName()).thenReturn("admin@test");
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        com.smboutique.api.model.Utilisateur u = new com.smboutique.api.model.Utilisateur();
        u.setId(99L);
        com.smboutique.api.model.Role r = new com.smboutique.api.model.Role(); r.setName("SUPERADMIN");
        u.setRoles(java.util.Set.of(r));
        when(utilisateurService.findByEmail("admin@test")).thenReturn(Optional.of(u));

        CommandeClient c = new CommandeClient(); c.setId(55L);
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique(); b.setId(6L);
        c.setBoutique(b);
        c.setTotal(9999);

        when(commandeClientService.findById(55L)).thenReturn(Optional.of(c));

        controller.getCommandeClientPdf(55L, response);

        verify(pdfService, times(1)).writeCommandeClientPdf(55L, response);
        verify(mouvementService, times(1)).log(eq("DOCUMENT"), eq("COMMANDE_CLIENT_PDF"), anyString(), eq(55L), eq(6L), isNull(), any(), eq(Double.valueOf(9999)));
    }
}
