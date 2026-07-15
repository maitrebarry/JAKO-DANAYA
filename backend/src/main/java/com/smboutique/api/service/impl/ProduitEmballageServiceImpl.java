package com.smboutique.api.service.impl;

import com.smboutique.api.dto.ProduitEmballageDTO;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.ProduitEmballage;
import com.smboutique.api.model.Unite;
import com.smboutique.api.repository.ProduitEmballageRepository;
import com.smboutique.api.repository.ProduitRepository;
import com.smboutique.api.service.ProduitEmballageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ProduitEmballageServiceImpl implements ProduitEmballageService {

    @Autowired
    private ProduitEmballageRepository produitEmballageRepository;

    @Autowired
    private ProduitRepository produitRepository;

    private ProduitEmballageDTO toDTO(ProduitEmballage pe) {
        ProduitEmballageDTO dto = new ProduitEmballageDTO();
        dto.setId(pe.getId());
        dto.setNombreUnites(pe.getNombreUnites());
        dto.setEstParDefaut(pe.getEstParDefaut());
        if (pe.getUnite() != null) {
            dto.setUniteId(pe.getUnite().getId());
            dto.setUniteLibelle(pe.getUnite().getLibelle());
        }
        return dto;
    }

    @Override
    public List<ProduitEmballageDTO> findByProduitId(Long produitId) {
        return produitEmballageRepository.findByProduitId(produitId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ProduitEmballageDTO create(Produit produit, Unite unite, Integer nombreUnites, boolean estParDefaut) {
        List<ProduitEmballage> existing = produitEmballageRepository.findByProduitId(produit.getId());
        boolean makeDefault = estParDefaut || existing.isEmpty();
        if (makeDefault) {
            clearExistingDefault(existing);
        }

        ProduitEmballage pe = new ProduitEmballage();
        pe.setProduit(produit);
        pe.setUnite(unite);
        pe.setNombreUnites(nombreUnites);
        pe.setEstParDefaut(makeDefault);
        pe = produitEmballageRepository.save(pe);

        syncLegacyFields(produit);
        return toDTO(pe);
    }

    @Override
    @Transactional
    public ProduitEmballageDTO update(Produit produit, ProduitEmballage emballage, Unite unite, Integer nombreUnites, boolean estParDefaut) {
        List<ProduitEmballage> siblings = produitEmballageRepository.findByProduitId(produit.getId()).stream()
                .filter(e -> !e.getId().equals(emballage.getId()))
                .collect(Collectors.toList());

        // Never let a product end up with zero default emballages: if no sibling holds the
        // default flag, this row must keep it regardless of what was requested.
        boolean makeDefault = estParDefaut || siblings.stream().noneMatch(e -> Boolean.TRUE.equals(e.getEstParDefaut()));
        if (makeDefault) {
            clearExistingDefault(siblings);
        }

        emballage.setUnite(unite);
        emballage.setNombreUnites(nombreUnites);
        emballage.setEstParDefaut(makeDefault);
        ProduitEmballage saved = produitEmballageRepository.save(emballage);

        syncLegacyFields(produit);
        return toDTO(saved);
    }

    @Override
    @Transactional
    public void delete(Produit produit, ProduitEmballage emballage) {
        boolean wasDefault = Boolean.TRUE.equals(emballage.getEstParDefaut());
        produitEmballageRepository.delete(emballage);

        if (wasDefault) {
            List<ProduitEmballage> remaining = produitEmballageRepository.findByProduitId(produit.getId());
            if (!remaining.isEmpty()) {
                ProduitEmballage promoted = remaining.get(0);
                promoted.setEstParDefaut(true);
                produitEmballageRepository.save(promoted);
            }
        }

        syncLegacyFields(produit);
    }

    private void clearExistingDefault(List<ProduitEmballage> candidates) {
        candidates.stream()
                .filter(e -> Boolean.TRUE.equals(e.getEstParDefaut()))
                .forEach(e -> {
                    e.setEstParDefaut(false);
                    produitEmballageRepository.save(e);
                });
    }

    private void syncLegacyFields(Produit produit) {
        List<ProduitEmballage> list = produitEmballageRepository.findByProduitId(produit.getId());
        Optional<ProduitEmballage> def = list.stream()
                .filter(e -> Boolean.TRUE.equals(e.getEstParDefaut()))
                .findFirst();
        if (def.isPresent()) {
            produit.setUnite(def.get().getUnite());
            produit.setNombreUnitesParConditionnement(def.get().getNombreUnites());
        } else {
            produit.setUnite(null);
            produit.setNombreUnitesParConditionnement(1);
        }
        produitRepository.save(produit);
    }
}
