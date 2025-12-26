package com.smboutique.api.controller;

import com.smboutique.api.model.Paiement;
import com.smboutique.api.service.PaiementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/paiements")
@CrossOrigin(origins = "*")
public class PaiementController {

    @Autowired
    private PaiementService paiementService;

    @Autowired
    private com.smboutique.api.service.PdfService pdfService;

    @GetMapping
    public List<Paiement> getAllPaiements() {
        return paiementService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Paiement> getPaiementById(@PathVariable Long id) {
        return paiementService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pdf")
    public void getPaiementPdf(@PathVariable Long id, jakarta.servlet.http.HttpServletResponse response) {
        try {
            pdfService.writePaiementPdf(id, response);
        } catch (Exception e) {
            try { response.sendError(500); } catch (Exception ignored) {}
        }
    }

    @PostMapping
    public Paiement createPaiement(@RequestBody Paiement paiement) {
        return paiementService.save(paiement);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Paiement> updatePaiement(@PathVariable Long id, @RequestBody Paiement paiementDetails) {
        return paiementService.findById(id)
                .map(paiement -> {
                    paiement.setMontantPaye(paiementDetails.getMontantPaye());
                    paiement.setDatePaie(paiementDetails.getDatePaie());
                    paiement.setReference(paiementDetails.getReference());
                    paiement.setCommandeFournisseur(paiementDetails.getCommandeFournisseur());
                    return ResponseEntity.ok(paiementService.save(paiement));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePaiement(@PathVariable Long id) {
        return paiementService.findById(id)
                .map(paiement -> {
                    paiementService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
