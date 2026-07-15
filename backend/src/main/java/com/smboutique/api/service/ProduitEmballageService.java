package com.smboutique.api.service;

import com.smboutique.api.dto.ProduitEmballageDTO;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.ProduitEmballage;
import com.smboutique.api.model.Unite;

import java.util.List;

public interface ProduitEmballageService {
    List<ProduitEmballageDTO> findByProduitId(Long produitId);

    ProduitEmballageDTO create(Produit produit, Unite unite, Integer nombreUnites, boolean estParDefaut);

    ProduitEmballageDTO update(Produit produit, ProduitEmballage emballage, Unite unite, Integer nombreUnites, boolean estParDefaut);

    void delete(Produit produit, ProduitEmballage emballage);
}
