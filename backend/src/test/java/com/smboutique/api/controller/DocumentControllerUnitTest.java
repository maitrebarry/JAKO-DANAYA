package com.smboutique.api.controller;

import com.smboutique.api.model.Vente;
import com.smboutique.api.service.PdfService;
import com.smboutique.api.service.MouvementService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.repository.VenteRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import static org.mockito.Mockito.*;
public class DocumentControllerUnitTest {

    private DocumentController controller;
    private VenteRepository venteRepository;
    private com.smboutique.api.repository.CaisseTransactionRepository caisseTransactionRepository;
    private PdfService pdfService;
    private MouvementService mouvementService;
    private UtilisateurService utilisateurService;
    private HttpServletResponse response;

    @BeforeEach
    public void setup() {
        controller = new DocumentController();
        venteRepository = mock(VenteRepository.class);
        pdfService = mock(PdfService.class);
        mouvementService = mock(MouvementService.class);
        utilisateurService = mock(UtilisateurService.class);
        response = mock(HttpServletResponse.class);

        // inject
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "venteRepository", venteRepository);
        caisseTransactionRepository = mock(com.smboutique.api.repository.CaisseTransactionRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "caisseTransactionRepository", caisseTransactionRepository);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "pdfService", pdfService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "mouvementService", mouvementService);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "utilisateurService", utilisateurService);
    }

    @Test
    public void testDownloadVentePdfLogsMouvement() throws Exception {
        Vente v = new Vente();
        v.setId(123L);
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique();
        b.setId(5L);
        v.setBoutique(b);
        v.setMontantTotal(25000);

        when(venteRepository.findById(123L)).thenReturn(Optional.of(v));

        // call
        controller.download("vente", 123L, "pdf", response);

        // verify pdf generated
        verify(pdfService, times(1)).writeVentePdf(123L, response);
        // verify mouvement logged (we don't assert full args, just that it's called)
        verify(mouvementService, times(1)).log(eq("DOCUMENT"), eq("VENTE_PDF"), anyString(), eq(123L), eq(5L), isNull(), any(), eq(Double.valueOf(25000)));
    }

    @Test
    public void testDownloadCaisseTransactionWithoutPaiement() throws Exception {
        com.smboutique.api.model.CaisseTransaction tx = new com.smboutique.api.model.CaisseTransaction();
        tx.setId(99L);
        tx.setBoutiqueId(5L);
        tx.setMontant(5000);
        tx.setReferenceCaisse("CAISSE-99");
        when(caisseTransactionRepository.findById(99L)).thenReturn(Optional.of(tx));

        // call
        controller.download("caisse", 99L, "pdf", response);

        // verify pdf generated for transaction
        verify(pdfService, times(1)).writeCaisseTransactionPdf(99L, response);
        // verify mouvement logged
        verify(mouvementService, times(1)).log(eq("DOCUMENT"), eq("CAISSE_PDF"), anyString(), eq(99L), eq(5L), isNull(), any(), eq(Double.valueOf(5000)));
    }
}
