package com.smboutique.api.controller;

import com.smboutique.api.model.Livraison;
import com.smboutique.api.service.PdfService;
import com.smboutique.api.service.MouvementService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.service.LivraisonService;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.mockito.Mockito.*;

public class LivraisonControllerTest {
    private com.smboutique.api.controller.LivraisonController controller;
    private LivraisonService livraisonService;
    private PdfService pdfService;
    private MouvementService mouvementService;
    private UtilisateurService utilisateurService;
    private HttpServletResponse response;

    @BeforeEach
    public void setup() {
        controller = new com.smboutique.api.controller.LivraisonController();
        livraisonService = mock(LivraisonService.class);
        pdfService = mock(PdfService.class);
        mouvementService = mock(MouvementService.class);
        utilisateurService = mock(UtilisateurService.class);
        response = mock(HttpServletResponse.class);

        org.springframework.test.util.ReflectionTestUtils.setField(controller, "livraisonService", livraisonService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "pdfService", pdfService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "mouvementService", mouvementService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "utilisateurService", utilisateurService);
    }

    @Test
    public void testGetLivraisonPdfLogsMouvement() throws Exception {
        Livraison l = new Livraison();
        l.setId(44L);
        com.smboutique.api.model.CommandeClient cc = new com.smboutique.api.model.CommandeClient();
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique(); b.setId(7L);
        cc.setBoutique(b);
        l.setCommandeClient(cc);

        when(livraisonService.findById(44L)).thenReturn(Optional.of(l));

        controller.getLivraisonPdf(44L, response);

        verify(pdfService, times(1)).writeLivraisonPdf(44L, response);
        verify(mouvementService, times(1)).log(eq("DOCUMENT"), eq("LIVRAISON_PDF"), anyString(), eq(44L), eq(7L), isNull(), any(), isNull());
    }
}
