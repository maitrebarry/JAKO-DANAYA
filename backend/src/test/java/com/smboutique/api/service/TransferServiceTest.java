package com.smboutique.api.service;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.Magasin;
import com.smboutique.api.model.Mouvement;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.StockRepository;
import com.smboutique.api.service.impl.TransferServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class TransferServiceTest {

    @Mock
    private StockRepository stockRepository;

    @Mock
    private MouvementService mouvementService;

    @InjectMocks
    private TransferServiceImpl transferService;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    public void transfer_success_updatesStocks_andCreatesMouvements() {
        Boutique b = new Boutique(); b.setId(1L);
        Magasin m = new Magasin(); m.setId(10L); m.setBoutique(b);

        Produit p = new Produit(); p.setId(2L);

        Stock src = new Stock(); src.setId(100L); src.setMagasin(m); src.setProduit(p); src.setQuantiteDisponible(5);
        Stock dst = new Stock(); dst.setId(101L); dst.setMagasin(null); dst.setProduit(p); dst.setQuantiteDisponible(1);

        when(stockRepository.findById(100L)).thenReturn(Optional.of(src));
        when(stockRepository.findById(101L)).thenReturn(Optional.of(dst));

        transferService.transfer(100L, 101L, 3);

        // verify quantities updated
        assertEquals(2, src.getQuantiteDisponible());
        assertEquals(4, dst.getQuantiteDisponible());

        // verify mouvements created (save called twice)
        org.mockito.Mockito.verify(mouvementService, org.mockito.Mockito.times(2)).save(org.mockito.ArgumentMatchers.any(Mouvement.class));
    }

    @Test
    public void transfer_insufficientStock_throws() {
        Magasin m = new Magasin(); m.setId(10L);
        Produit p = new Produit(); p.setId(2L);
        Stock src = new Stock(); src.setId(100L); src.setMagasin(m); src.setProduit(p); src.setQuantiteDisponible(2);
        Stock dst = new Stock(); dst.setId(101L); dst.setMagasin(null); dst.setProduit(p); dst.setQuantiteDisponible(0);

        when(stockRepository.findById(100L)).thenReturn(Optional.of(src));
        when(stockRepository.findById(101L)).thenReturn(Optional.of(dst));

        assertThrows(IllegalArgumentException.class, () -> transferService.transfer(100L, 101L, 3));
    }
}
