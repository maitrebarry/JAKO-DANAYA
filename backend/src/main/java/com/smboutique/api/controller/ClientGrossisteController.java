package com.smboutique.api.controller;

import com.smboutique.api.model.ClientGrossiste;
import com.smboutique.api.service.ClientGrossisteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/clients-grossistes")
@CrossOrigin(origins = "*")
public class ClientGrossisteController {

    @Autowired
    private ClientGrossisteService clientGrossisteService;

    @GetMapping
    public List<ClientGrossiste> getAllClientGrossistes() {
        return clientGrossisteService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClientGrossiste> getClientGrossisteById(@PathVariable Long id) {
        return clientGrossisteService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ClientGrossiste createClientGrossiste(@RequestBody ClientGrossiste clientGrossiste) {
        return clientGrossisteService.save(clientGrossiste);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClientGrossiste> updateClientGrossiste(@PathVariable Long id, @RequestBody ClientGrossiste clientGrossisteDetails) {
        return clientGrossisteService.findById(id)
                .map(clientGrossiste -> {
                    clientGrossiste.setNom(clientGrossisteDetails.getNom());
                    clientGrossiste.setPrenom(clientGrossisteDetails.getPrenom());
                    clientGrossiste.setContact(clientGrossisteDetails.getContact());
                    clientGrossiste.setVille(clientGrossisteDetails.getVille());
                    return ResponseEntity.ok(clientGrossisteService.save(clientGrossiste));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClientGrossiste(@PathVariable Long id) {
        return clientGrossisteService.findById(id)
                .map(clientGrossiste -> {
                    clientGrossisteService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
