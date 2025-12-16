package com.smboutique.api.service;

import com.smboutique.api.model.Produit;
import com.smboutique.api.dto.ProduitCreateDTO;
import java.util.List;
import java.util.Optional;

public interface ProduitService {
    List<Produit> findAll();
    Optional<Produit> findById(Long id);
    Produit save(Produit produit);
    Produit create(ProduitCreateDTO dto, Long boutiqueId);
    void deleteById(Long id);
    List<Produit> findByBoutiqueId(Long boutiqueId);
    com.smboutique.api.dto.ImportResult importFromExcel(org.springframework.web.multipart.MultipartFile file, com.smboutique.api.model.Utilisateur currentUser) throws Exception;
}
