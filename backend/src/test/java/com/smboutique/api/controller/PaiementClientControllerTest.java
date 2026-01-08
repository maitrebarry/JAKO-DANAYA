package com.smboutique.api.controller;

import com.smboutique.api.model.PaiementClient;
import com.smboutique.api.service.PdfService;
import com.smboutique.api.service.MouvementService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.service.PaiementClientService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.mockito.Mockito.*;

public class PaiementClientControllerTest {
    private com.smboutique.api.controller.PaiementClientController controller;
    private PaiementClientService paiementClientService;
    private PdfService pdfService;
    private MouvementService mouvementService;
    private UtilisateurService utilisateurService;
    private HttpServletResponse response;

    @BeforeEach
    public void setup() {
        controller = new com.smboutique.api.controller.PaiementClientController();
        paiementClientService = mock(PaiementClientService.class);
        pdfService = mock(PdfService.class);
        mouvementService = mock(MouvementService.class);
        utilisateurService = mock(UtilisateurService.class);
        response = mock(HttpServletResponse.class);

        org.springframework.test.util.ReflectionTestUtils.setField(controller, "paiementClientService", paiementClientService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "pdfService", pdfService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "mouvementService", mouvementService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "utilisateurService", utilisateurService);
    }

    @Test
    public void testGetPaiementClientPdfLogsMouvement() throws Exception {
        PaiementClient p = new PaiementClient();
        p.setId(77L);
        p.setMontantPaye(4500);
        com.smboutique.api.model.CommandeClient cmd = new com.smboutique.api.model.CommandeClient();
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique(); b.setId(8L);
        cmd.setBoutique(b);
        p.setCommandeClient(cmd);

        when(paiementClientService.findById(77L)).thenReturn(Optional.of(p));

        controller.getPaiementClientPdf(77L, response);

        verify(pdfService, times(1)).writePaiementClientPdf(77L, response);
        verify(mouvementService, times(1)).log(eq("DOCUMENT"), eq("PAIEMENT_CLIENT_PDF"), anyString(), eq(77L), eq(8L), isNull(), any(), eq(Double.valueOf(4500)));
    }
}
