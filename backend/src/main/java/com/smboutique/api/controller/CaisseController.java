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
    public Caisse createCaisse(@RequestBody Caisse caisse) {
        return caisseService.save(caisse);
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
