package com.smboutique.api.service.impl;

import com.smboutique.api.service.DashboardService;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.ClientGrossisteService;
import com.smboutique.api.service.FournisseurService;
import com.smboutique.api.service.CommandeClientService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.dto.DashboardOverviewDTO;
import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.model.Stock;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Service
public class DashboardServiceImpl implements DashboardService {

    private final ProduitService produitService;
    private final ClientGrossisteService clientGrossisteService;
    private final FournisseurService fournisseurService;
    private final CommandeClientService commandeClientService;
    private final StockService stockService;

    public DashboardServiceImpl(ProduitService produitService,
                                ClientGrossisteService clientGrossisteService,
                                FournisseurService fournisseurService,
                                CommandeClientService commandeClientService,
                                StockService stockService) {
        this.produitService = produitService;
        this.clientGrossisteService = clientGrossisteService;
        this.fournisseurService = fournisseurService;
        this.commandeClientService = commandeClientService;
        this.stockService = stockService;
    }

    @Override
    public DashboardOverviewDTO getOverview(Long boutiqueId) {
        DashboardOverviewDTO dto = new DashboardOverviewDTO();

        // counts
        dto.setProductsCount(produitService.findAll().size());
        dto.setClientsCount(clientGrossisteService.findAll().size());
        dto.setSuppliersCount(fournisseurService.findAll().size());

        // commandes (scope boutique if provided)
        List<CommandeClient> commandes = (boutiqueId == null) ? commandeClientService.findAll() : commandeClientService.findAllByBoutiqueId(boutiqueId);

        long salesTotal = commandes.stream().mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue()).sum();
        dto.setSalesTotal(salesTotal);

        // today sales
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = LocalDateTime.now();
        long salesToday = commandes.stream()
                .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(start) && !c.getDateCommande().isAfter(end))
                .mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue())
                .sum();
        dto.setSalesToday(salesToday);

        // pending orders: paie null or less than total
        long pending = commandes.stream().filter(c -> c.getTotal() != null && (c.getPaie() == null || c.getPaie().intValue() < c.getTotal().intValue())).count();
        dto.setPendingOrders(pending);

        // low stock count (threshold 5)
        List<Stock> stocks = stockService.getAllStocks();
        long lowStock = stocks.stream()
                .filter(s -> (boutiqueId == null || (s.getBoutique() != null && s.getBoutique().getId().equals(boutiqueId))) )
                .filter(s -> s.getQuantiteDisponible() == null || s.getQuantiteDisponible() <= 5)
                .count();
        dto.setLowStockCount(lowStock);

        return dto;
    }
}
