package com.smboutique.api.service.impl;

import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.StockRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;

public class StockServiceImplTest {

    @Mock
    private StockRepository stockRepository;

    @InjectMocks
    private StockServiceImpl stockService;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    public void getBoutiqueLevelStocks_delegatesToRepository() {
        Stock s = new Stock(); s.setId(42L);
        when(stockRepository.findByBoutiqueIdAndMagasinIsNull(10L)).thenReturn(List.of(s));

        var res = stockService.getBoutiqueLevelStocks(10L);

        verify(stockRepository).findByBoutiqueIdAndMagasinIsNull(10L);
        assertThat(res).hasSize(1);
        assertThat(res.get(0).getId()).isEqualTo(42L);
    }
}
