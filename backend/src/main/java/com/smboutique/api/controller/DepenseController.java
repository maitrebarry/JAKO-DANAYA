package com.smboutique.api.controller;

import com.smboutique.api.model.Depense;
import com.smboutique.api.service.DepenseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/depenses")
@CrossOrigin(origins = "*")
public class DepenseController {

    @Autowired
    private DepenseService depenseService;

    @GetMapping
    public List<Depense> getAllDepenses() {
        return depenseService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Depense> getDepenseById(@PathVariable Long id) {
        return depenseService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Depense createDepense(@RequestBody Depense depense) {
        return depenseService.save(depense);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Depense> updateDepense(@PathVariable Long id, @RequestBody Depense depenseDetails) {
        return depenseService.findById(id)
                .map(depense -> {
                    depense.setReferenceCaisse(depenseDetails.getReferenceCaisse());
                    depense.setLibelle(depenseDetails.getLibelle());
                    depense.setMontant(depenseDetails.getMontant());
                    depense.setDate(depenseDetails.getDate());
                    depense.setNote(depenseDetails.getNote());
                    return ResponseEntity.ok(depenseService.save(depense));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDepense(@PathVariable Long id) {
        return depenseService.findById(id)
                .map(depense -> {
                    depenseService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
