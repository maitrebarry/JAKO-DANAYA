package com.smboutique.api.controller;

import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.UtilisateurService;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import org.junit.jupiter.api.extension.ExtendWith;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ProduitControllerUnitTest {

    @Mock
    private ProduitService produitService;

    @Mock
    private UtilisateurService utilisateurService;

    @InjectMocks
    private ProduitController produitController;

    @Test
    public void importAsync_returns_jobId_and_202() {
        MockMultipartFile mf = new MockMultipartFile("file", "p.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new byte[0]);
        // simulate authenticated user lookup by stubbing SecurityContext
        org.springframework.security.core.Authentication auth = new org.springframework.security.authentication.TestingAuthenticationToken("me", "x");
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
        when(utilisateurService.findByEmail(anyString())).thenReturn(java.util.Optional.of(new com.smboutique.api.model.Utilisateur()));
        when(utilisateurService.hasPermission(any(), eq("PRODUIT_CREER"))).thenReturn(true);
        when(produitService.startAsyncImport(any(), any(), anyBoolean())).thenReturn("job-123");

        ResponseEntity<?> resp = produitController.importFromExcelAsync(mf, false);
        assertEquals(202, resp.getStatusCodeValue());
        assertNotNull(resp.getBody());
        @SuppressWarnings("unchecked")
        java.util.Map<String, String> body = (java.util.Map<String, String>) resp.getBody();
        assertEquals("job-123", body.get("jobId"));
        verify(produitService, times(1)).startAsyncImport(any(), any(), eq(false));
    }
}
