package com.smboutique.api.service.impl;

import com.smboutique.api.model.Reception;
import com.smboutique.api.model.LigneCommande;
import com.smboutique.api.model.LigneReception;
import com.smboutique.api.dto.ReceptionListDTO;
import com.smboutique.api.repository.ReceptionRepository;
import com.smboutique.api.repository.LigneCommandeRepository;
import com.smboutique.api.repository.LigneReceptionRepository;
import com.smboutique.api.service.ReceptionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ReceptionServiceImpl implements ReceptionService {

    @Autowired
    private ReceptionRepository receptionRepository;

    @Autowired
    private LigneCommandeRepository ligneCommandeRepository;

    @Autowired
    private LigneReceptionRepository ligneReceptionRepository;

    @Override
    public List<Reception> findAll() {
        return receptionRepository.findAll();
    }

    @Override
    public List<ReceptionListDTO> findAllReceptionsList() {
        return receptionRepository.findAll().stream()
            .map(this::convertToListDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<Reception> findUnfinishedReceptions() {
        List<Reception> all = receptionRepository.findAll();
        return all.stream().filter(this::isUnfinished).collect(Collectors.toList());
    }

    @Override
    public List<ReceptionListDTO> findUnfinishedReceptionsList() {
        return findUnfinishedReceptions().stream()
            .map(this::convertToListDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<Reception> findFinishedReceptions() {
        List<Reception> all = receptionRepository.findAll();
        return all.stream().filter(r -> !isUnfinished(r)).collect(Collectors.toList());
    }

    @Override
    public List<ReceptionListDTO> findFinishedReceptionsList() {
        return findFinishedReceptions().stream()
            .map(this::convertToListDTO)
            .collect(Collectors.toList());
    }

    // Méthodes filtrées par boutique
    @Override
    public List<Reception> findUnfinishedReceptionsByBoutiqueId(Long boutiqueId) {
        List<Reception> receptions = receptionRepository.findByBoutiqueId(boutiqueId);
        return receptions.stream().filter(this::isUnfinished).collect(Collectors.toList());
    }

    @Override
    public List<Reception> findFinishedReceptionsByBoutiqueId(Long boutiqueId) {
        List<Reception> receptions = receptionRepository.findByBoutiqueId(boutiqueId);
        return receptions.stream().filter(r -> !isUnfinished(r)).collect(Collectors.toList());
    }

    @Override
    public List<ReceptionListDTO> findUnfinishedReceptionsListByBoutiqueId(Long boutiqueId) {
        return findUnfinishedReceptionsByBoutiqueId(boutiqueId).stream()
            .map(this::convertToListDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<ReceptionListDTO> findFinishedReceptionsListByBoutiqueId(Long boutiqueId) {
        return findFinishedReceptionsByBoutiqueId(boutiqueId).stream()
            .map(this::convertToListDTO)
            .collect(Collectors.toList());
    }

    private boolean isUnfinished(Reception reception) {
        List<LigneCommande> lignesCommande = ligneCommandeRepository.findByCommandeFournisseurId(reception.getCommandeFournisseur().getId());
        List<LigneReception> lignesReception = ligneReceptionRepository.findByReceptionId(reception.getId());

        for (LigneCommande lc : lignesCommande) {
            int qteRecue = lignesReception.stream()
                .filter(lr -> lr.getProduit().getId().equals(lc.getStock().getProduit().getId()))
                .mapToInt(LigneReception::getQuantiteRecu)
                .sum();
            if (qteRecue < lc.getQuantite()) {
                return true;
            }
        }
        return false;
    }

    private ReceptionListDTO convertToListDTO(Reception reception) {
        ReceptionListDTO dto = new ReceptionListDTO();
        dto.setIdReception(reception.getId());
        dto.setDateReception(reception.getDateReception());
        dto.setReceptRef(reception.getReference());

        if (reception.getCommandeFournisseur() != null) {
            dto.setReferenceCommande(reception.getCommandeFournisseur().getReference());

            if (reception.getCommandeFournisseur().getFournisseur() != null) {
                dto.setNomFournisseur(reception.getCommandeFournisseur().getFournisseur().getNom());
                dto.setPrenomFournisseur(reception.getCommandeFournisseur().getFournisseur().getPrenom());
            }
        }

        return dto;
    }

    @Override
    public Optional<Reception> findById(Long id) {
        return receptionRepository.findById(id);
    }

    @Override
    public Reception save(Reception reception) {
        return receptionRepository.save(reception);
    }

    @Override
    public void deleteById(Long id) {
        receptionRepository.deleteById(id);
    }
}
