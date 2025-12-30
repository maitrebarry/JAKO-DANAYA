package com.smboutique.api.controller;

import com.smboutique.api.model.Caisse;
import com.smboutique.api.service.CaisseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/caisses")
@CrossOrigin(origins = "*")
public class CaisseController {

    @Autowired
    private CaisseService caisseService;

    @Autowired
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    @GetMapping
    public List<Caisse> getAllCaisses() {
        return caisseService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Caisse> getCaisseById(@PathVariable Long id) {
        return caisseService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Caisse> createCaisse(@RequestBody Caisse caisse) {
        try {
            if (caisse.getBoutique() == null || caisse.getBoutique().getId() == null) return ResponseEntity.badRequest().build();
            Long bid = caisse.getBoutique().getId();
            Integer max = caisseRepository.findMaxNumeroByBoutiqueId(bid);
            int next = (max == null) ? 1 : (max + 1);
            caisse.setNumero(next);

            // If reference not provided, generate server-side using numero
            java.time.LocalDate dt = caisse.getDateCaisse() != null ? caisse.getDateCaisse() : java.time.LocalDate.now();
            String month = String.format("%02d", dt.getMonthValue());
            String year = String.valueOf(dt.getYear());
            String ref = String.format("CAISSE-%s-%s-N°%d", month, year, next);
            caisse.setReference(ref);

            Caisse saved = caisseService.save(caisse);
            return ResponseEntity.ok(saved);
        } catch (Exception ex) {
            return ResponseEntity.status(500).build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Caisse> updateCaisse(@PathVariable Long id, @RequestBody Caisse caisseDetails) {
        return caisseService.findById(id)
                .map(caisse -> {
                    caisse.setDateCaisse(caisseDetails.getDateCaisse());
                    caisse.setMontantInitial(caisseDetails.getMontantInitial());
                    caisse.setStatut(caisseDetails.getStatut());
                    caisse.setReference(caisseDetails.getReference());
                    caisse.setMontantTotal(caisseDetails.getMontantTotal());
                    return ResponseEntity.ok(caisseService.save(caisse));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCaisse(@PathVariable Long id) {
        return caisseService.findById(id)
                .map(caisse -> {
                    caisseService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
