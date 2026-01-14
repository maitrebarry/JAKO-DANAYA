package com.smboutique.api.service;

import com.smboutique.api.dto.StockReportItemDTO;
import com.smboutique.api.dto.TopProductDTO;
import com.smboutique.api.dto.ValeurStockDTO;
import com.smboutique.api.dto.VenteJournalierDTO;
import com.smboutique.api.model.LigneVente;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.LigneVenteRepository;
import com.smboutique.api.repository.ProduitRepository;
import com.smboutique.api.repository.StockRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RapportService {

    @Autowired
    private LigneVenteRepository ligneVenteRepository;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private ProduitRepository produitRepository;

    /**
     * Ventes journalières (agrégées par date)
     */
    public List<VenteJournalierDTO> ventes(LocalDate from, LocalDate to, Long boutiqueId) {
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);
        List<LigneVente> lignes = ligneVenteRepository.findByVenteDateRangeAndBoutique(fromDt, toDt, boutiqueId);

        // Group by date (day) based on vente.dateVente
        Map<LocalDate, List<LigneVente>> grouped = new HashMap<>();
        for (var l : lignes) {
            LocalDate date = l.getVente().getDateVente().toLocalDate();
            grouped.computeIfAbsent(date, k -> new ArrayList<>()).add(l);
        }

        List<VenteJournalierDTO> result = new ArrayList<>();
        for (var entry : grouped.entrySet()) {
            long montant = entry.getValue().stream().mapToLong(l -> (l.getQuantite() != null ? l.getQuantite() : 0) * (l.getNewPrice() != null ? l.getNewPrice() : 0)).sum();
            long nombreVentes = entry.getValue().stream().map(l -> l.getVente().getId()).distinct().count();
            result.add(new VenteJournalierDTO(entry.getKey(), nombreVentes, montant));
        }

        result.sort(Comparator.comparing(VenteJournalierDTO::getDate));
        return result;
    }

    /**
     * Stock actuel par boutique
     */
    public List<StockReportItemDTO> stock(Long boutiqueId) {
        List<Stock> stocks = stockRepository.findByProduitIdAndBoutiqueId(null, boutiqueId);
        List<StockReportItemDTO> list = new ArrayList<>();
        for (var s : stocks) {
            StockReportItemDTO dto = new StockReportItemDTO();
            dto.setStockId(s.getId());
            if (s.getProduit() != null) {
                dto.setProduitId(s.getProduit().getId());
                dto.setProduitName(s.getProduit().getNomProduit());
            }
            dto.setQuantiteDisponible(s.getQuantiteDisponible());
            dto.setCostAverage(s.getCostAverage());
            dto.setLastPurchasePrice(s.getLastPurchasePrice());
            if (s.getMagasin() != null) {
                dto.setMagasinId(s.getMagasin().getId());
                dto.setMagasinName(s.getMagasin().getNom());
            }
            list.add(dto);
        }
        return list;
    }

    /**
     * Valeur du stock (somme quantite * costAverage (ou lastPurchasePrice))
     */
    public ValeurStockDTO valeurStock(Long boutiqueId) {
        List<StockReportItemDTO> details = stock(boutiqueId);
        BigDecimal total = BigDecimal.ZERO;
        for (var d : details) {
            BigDecimal qty = BigDecimal.valueOf(d.getQuantiteDisponible() != null ? d.getQuantiteDisponible() : 0);
            BigDecimal price = d.getCostAverage() != null ? d.getCostAverage() : (d.getLastPurchasePrice() != null ? d.getLastPurchasePrice() : BigDecimal.ZERO);
            total = total.add(qty.multiply(price));
        }
        ValeurStockDTO r = new ValeurStockDTO();
        r.setDetails(details);
        r.setValeurTotale(total);
        return r;
    }

    /**
     * Produits les plus vendus dans une période
     */
    public List<TopProductDTO> topProduits(LocalDate from, LocalDate to, Long boutiqueId, int limit) {
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.atTime(LocalTime.MAX);
        List<LigneVente> lignes = ligneVenteRepository.findByVenteDateRangeAndBoutique(fromDt, toDt, boutiqueId);

        Map<Long, TopProductDTO> agg = new HashMap<>();

        for (var l : lignes) {
            var p = l.getProduit();
            if (p == null) continue;
            long qty = l.getQuantite() != null ? l.getQuantite() : 0;
            long amount = qty * (l.getNewPrice() != null ? l.getNewPrice() : 0);
            var existing = agg.get(p.getId());
            if (existing == null) {
                agg.put(p.getId(), new TopProductDTO(p.getId(), p.getNomProduit(), qty, amount));
            } else {
                existing.setQuantiteVendue(existing.getQuantiteVendue() + qty);
                existing.setMontantTotal(existing.getMontantTotal() + amount);
            }
        }

        return agg.values().stream()
                .sorted(Comparator.comparingLong(TopProductDTO::getQuantiteVendue).reversed())
                .limit(limit)
                .collect(Collectors.toList());
    }
}