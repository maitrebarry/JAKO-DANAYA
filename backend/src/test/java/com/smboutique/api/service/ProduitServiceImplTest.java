package com.smboutique.api.service;

import com.smboutique.api.dto.ProduitCreateDTO;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.MagasinRepository;
import com.smboutique.api.repository.ProduitRepository;
import com.smboutique.api.repository.UniteRepository;
import com.smboutique.api.service.impl.ProduitServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ProduitServiceImplTest {

    @Mock
    private ProduitRepository produitRepository;

    @Mock
    private UniteRepository uniteRepository;

    @Mock
    private MagasinRepository magasinRepository;

    @Mock
    private com.smboutique.api.service.StockService stockService;

    @Mock
    private com.smboutique.api.service.ConfigurationMargeService configurationMargeService;

    @Mock
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    @InjectMocks
    private ProduitServiceImpl produitService;

    @Test
    public void create_should_create_boutique_stock_with_quantite_initiale() {
        ProduitCreateDTO dto = new ProduitCreateDTO();
        dto.setNomProduit("TestProd");
        dto.setQuantiteInitiale(2);
        dto.setNombreUnitesParConditionnement(1);

        Long boutiqueId = 10L;

        when(produitRepository.save(any(Produit.class))).thenAnswer(invocation -> {
            Produit p = invocation.getArgument(0);
            p.setId(123L);
            return p;
        });


        // ensure boutiqueRepository returns the boutique so service can set it on the stock
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique(); b.setId(boutiqueId);
        when(boutiqueRepository.findById(boutiqueId)).thenReturn(java.util.Optional.of(b));

        dto.setCaracteristique("🔥Processeur : Intel Core i7\n🔥Stockage: 512Go SSD");

        Produit created = produitService.create(dto, boutiqueId);
        assertEquals("🔥Processeur : Intel Core i7\n🔥Stockage: 512Go SSD", created.getCaracteristique());

        ArgumentCaptor<Stock> captor = ArgumentCaptor.forClass(Stock.class);
        verify(stockService, times(1)).saveStock(captor.capture());
        Stock stock = captor.getValue();
        assertNull(stock.getMagasin(), "The created stock should be a boutique-level stock (magasin == null)");
        assertNotNull(stock.getQuantiteDisponible());
        // quantiteInitiale is expressed in conditionnements and should be converted to units (1*2 = 2)
        assertEquals(2, stock.getQuantiteDisponible().intValue());
        assertNotNull(stock.getProduit());
        assertEquals(123L, stock.getProduit().getId().longValue());
        assertNotNull(stock.getBoutique());
        assertEquals(boutiqueId, stock.getBoutique().getId());
    }
}
