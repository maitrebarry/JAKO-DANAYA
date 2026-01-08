package com.smboutique.api.controller;

import com.smboutique.api.model.Depense;
import com.smboutique.api.service.PdfService;
import com.smboutique.api.service.MouvementService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.service.DepenseService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.mockito.Mockito.*;

public class DepenseControllerTest {
    private com.smboutique.api.controller.DepenseController controller;
    private DepenseService depenseService;
    private PdfService pdfService;
    private MouvementService mouvementService;
    private UtilisateurService utilisateurService;
    private HttpServletResponse response;

    @BeforeEach
    public void setup() {
        controller = new com.smboutique.api.controller.DepenseController();
        depenseService = mock(DepenseService.class);
        pdfService = mock(PdfService.class);
        mouvementService = mock(MouvementService.class);
        utilisateurService = mock(UtilisateurService.class);
        response = mock(HttpServletResponse.class);

        org.springframework.test.util.ReflectionTestUtils.setField(controller, "depenseService", depenseService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "pdfService", pdfService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "mouvementService", mouvementService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "utilisateurService", utilisateurService);
    }

    @Test
    public void testGetDepensePdfLogsMouvementAsSuperAdmin() throws Exception {
        // set auth as admin
        org.springframework.security.core.Authentication auth = mock(org.springframework.security.core.Authentication.class);
        when(auth.getName()).thenReturn("admin@test");
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        com.smboutique.api.model.Utilisateur u = new com.smboutique.api.model.Utilisateur();
        u.setId(100L);
        com.smboutique.api.model.Role r = new com.smboutique.api.model.Role(); r.setName("SUPERADMIN");
        u.setRoles(java.util.Set.of(r));
        when(utilisateurService.findByEmail("admin@test")).thenReturn(Optional.of(u));

        Depense d = new Depense(); d.setId(66L); d.setBoutiqueId(3L); d.setMontant(7200);
        when(depenseService.findById(66L)).thenReturn(Optional.of(d));

        controller.getDepensePdf(66L, response);

        verify(pdfService, times(1)).writeDepensePdf(66L, response);
        verify(mouvementService, times(1)).log(eq("DOCUMENT"), eq("DEPENSE_PDF"), anyString(), eq(66L), eq(3L), isNull(), any(), eq(Double.valueOf(7200)));
    }
}
