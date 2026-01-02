package com.smboutique.api.controller;

import com.smboutique.api.model.Magasin;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.StockRepository;
import com.smboutique.api.service.CaisseService;
import com.smboutique.api.service.UtilisateurService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

public class VenteControllerTest {

    @Mock
    private com.smboutique.api.service.VenteService venteService;

    @Mock
    private com.smboutique.api.service.LigneVenteService ligneVenteService;

    @Mock
    private StockRepository stockRepository;

    @Mock
    private UtilisateurService utilisateurService;

    @Mock
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    @Mock
    private com.smboutique.api.service.CaisseService caisseService;

    @Mock
    private com.smboutique.api.service.CaisseTransactionService caisseTransactionService;

    @Mock
    private com.smboutique.api.service.CaisseMovementService caisseMovementService;

    @Mock
    private com.smboutique.api.service.MouvementService mouvementService;

    @InjectMocks
    private VenteController venteController;

    private AutoCloseable mocks;

    @BeforeEach
    public void setUp() {
        mocks = MockitoAnnotations.openMocks(this);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("user", "pw"));
    }

    @AfterEach
    public void tearDown() throws Exception {
        SecurityContextHolder.clearContext();
        mocks.close();
    }

    @Test
    public void createVenteCash_fromMagasinStock_shouldFail() {
        Utilisateur u = new Utilisateur();
        u.setEmail("user");
        com.smboutique.api.model.Permission p = new com.smboutique.api.model.Permission();
        p.setName("VENTE_CREER");
        u.setPermissions(new java.util.HashSet<>(java.util.List.of(p)));
        when(utilisateurService.findByEmail("user")).thenReturn(Optional.of(u));

        Stock s = new Stock();
        Magasin m = new Magasin();
        m.setId(7L);
        s.setMagasin(m);
        s.setQuantiteDisponible(10);

        when(stockRepository.findById(100L)).thenReturn(Optional.of(s));

        VenteController.VenteCashRequest req = new VenteController.VenteCashRequest();
        VenteController.CashLineRequest line = new VenteController.CashLineRequest();
        line.id_stock = 100L;
        line.quantite = 1;
        req.produitsSelectionnes.add(line);
        req.total = 100;
        req.montantRecu = 100;

        ResponseEntity<?> resp = venteController.createVenteCash(req);
        assertEquals(400, resp.getStatusCode().value());
    }
}
