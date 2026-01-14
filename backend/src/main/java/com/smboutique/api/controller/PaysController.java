package com.smboutique.api.controller;

import com.smboutique.api.model.Pays;
import com.smboutique.api.repository.PaysRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pays")
@CrossOrigin(origins = "*")
public class PaysController {

    @Autowired
    private PaysRepository paysRepository;

    @Autowired
    private com.smboutique.api.service.PaysSyncService paysSyncService;

    @GetMapping
    public List<Pays> listPays() {
        return paysRepository.findAll();
    }

    @GetMapping("/{code}")
    public ResponseEntity<Pays> getPaysByCode(@PathVariable String code) {
        return paysRepository.findByCodeIso(code.toUpperCase()).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/sync")
    public ResponseEntity<String> syncPays() {
        int count = paysSyncService.syncAll();
        return ResponseEntity.ok("Pays sync completed: " + count + " items");
    }

    @PostMapping("/sync/{code}")
    public ResponseEntity<?> syncPaysCode(@PathVariable String code) {
        Pays p = paysSyncService.refreshPays(code);
        if (p == null) return ResponseEntity.status(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to fetch " + code);
        return ResponseEntity.ok(p);
    }
}