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

    /* New: explicit flag to allow creating missing unités during import (must be authorized). */
    com.smboutique.api.dto.ImportResult importFromExcel(org.springframework.web.multipart.MultipartFile file, com.smboutique.api.model.Utilisateur currentUser, boolean createMissingUnits) throws Exception;

    /* Same as above, but threads a jobId through so the async job's ImportJobStatus gets real
     * per-row/per-image progress updates instead of jumping straight from "parsing" to "completed". */
    com.smboutique.api.dto.ImportResult importFromExcel(org.springframework.web.multipart.MultipartFile file, com.smboutique.api.model.Utilisateur currentUser, boolean createMissingUnits, String jobId) throws Exception;

    /* Async import job support */
    String startAsyncImport(org.springframework.web.multipart.MultipartFile file, com.smboutique.api.model.Utilisateur currentUser, boolean createMissingUnits);

    com.smboutique.api.dto.ImportJobStatus getImportJobStatus(String jobId);

    com.smboutique.api.dto.ImportResult getImportJobReport(String jobId);

    byte[] exportProduitsToExcel(Long boutiqueId);
}
