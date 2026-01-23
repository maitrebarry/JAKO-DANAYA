package com.smboutique.api.service.impl;

import com.smboutique.api.model.Unite;
import com.smboutique.api.repository.UniteRepository;
import com.smboutique.api.service.UniteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class UniteServiceImpl implements UniteService {

    @Autowired
    private UniteRepository uniteRepository;

    @Autowired
    private com.smboutique.api.service.BoutiqueService boutiqueService;

    @Override
    public List<Unite> findAll() {
        return uniteRepository.findAll();
    }

    @Override
    public List<Unite> findAllByBoutiqueId(Long boutiqueId) {
        return uniteRepository.findAllByBoutiqueId(boutiqueId);
    }

    @Override
    public Optional<Unite> findById(Long id) {
        return uniteRepository.findById(id);
    }

    @Override
    public Optional<Unite> findByIdAndBoutiqueId(Long id, Long boutiqueId) {
        return uniteRepository.findByIdAndBoutiqueId(id, boutiqueId);
    }

    @Override
    public Optional<Unite> findByBoutiqueIdAndCode(Long boutiqueId, String code) {
        if (boutiqueId == null || code == null) return Optional.empty();
        return uniteRepository.findByBoutiqueIdAndCode(boutiqueId, code.trim().toLowerCase());
    }

    @Override
    public Optional<Unite> findByBoutiqueIdAndLibelleIgnoreCase(Long boutiqueId, String libelle) {
        if (boutiqueId == null || libelle == null) return Optional.empty();
        return uniteRepository.findByBoutiqueIdAndLibelleIgnoreCase(boutiqueId, libelle.trim());
    }

    @Override
    public Unite createIfNotExistsForBoutique(Long boutiqueId, String code, String libelle, String symbole) {
        // normalize
        String normCode = code == null ? null : code.trim().toLowerCase();
        String normLib = libelle == null ? null : libelle.trim();

        // 1) try lookups
        Optional<Unite> found = null;
        if (normCode != null) found = uniteRepository.findByBoutiqueIdAndCode(boutiqueId, normCode);
        if ((found == null || found.isEmpty()) && normLib != null) found = uniteRepository.findByBoutiqueIdAndLibelleIgnoreCase(boutiqueId, normLib);
        if (found != null && found.isPresent()) return found.get();

        // 2) create (short transaction, handle concurrent inserts)
        Unite u = new Unite();
        u.setCode(normCode == null ? (normLib != null ? normLib.replaceAll("\\s+","_").toLowerCase() : null) : normCode);
        u.setLibelle(libelle != null ? libelle.trim() : u.getCode());
        u.setSymbole(symbole != null ? symbole.trim() : null);
        if (boutiqueId != null) {
            com.smboutique.api.model.Boutique b = boutiqueService.findById(boutiqueId).orElse(null);
            u.setBoutique(b);
        }
        try {
            return uniteRepository.save(u);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            // concurrent insert — re-query
            if (normCode != null) {
                return uniteRepository.findByBoutiqueIdAndCode(boutiqueId, normCode).orElseGet(() -> uniteRepository.findByBoutiqueIdAndLibelleIgnoreCase(boutiqueId, normLib).orElse(u));
            }
            return uniteRepository.findByBoutiqueIdAndLibelleIgnoreCase(boutiqueId, normLib).orElse(u);
        }
    }

    @Override
    public Unite save(Unite unite) {
        return uniteRepository.save(unite);
    }

    @Override
    public void deleteById(Long id) {
        uniteRepository.deleteById(id);
    }
}
