package com.smboutique.api.controller;

import com.smboutique.api.model.PaiementClient;
import com.smboutique.api.repository.PaiementClientRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard/cashier")
public class CashierController {

    private final PaiementClientRepository paiementClientRepository;

    public CashierController(PaiementClientRepository paiementClientRepository) {
        this.paiementClientRepository = paiementClientRepository;
    }

    @GetMapping("/transactions")
    @PreAuthorize("hasAnyRole('SUPERADMIN','CASHIER','ADMINISTRATEUR','PROPRIETAIRE','MANAGER')")
    public List<PaymentDTO> transactions(@RequestParam(value = "shiftId", required = false) Long shiftId, @RequestParam(value = "shopId", required = false) Long shopId) {
        // If shopId provided, return payments for that shop via commandeClient relation
        List<PaiementClient> payments = (shopId == null) ? paiementClientRepository.findAll() : paiementClientRepository.findByCommandeClientBoutiqueId(shopId);
        return payments.stream().filter(p -> !Boolean.TRUE.equals(p.getAnnule())).map(p -> new PaymentDTO(p.getId(), p.getReference(), p.getMontantPaye(), p.getDatePaie(), "UNKNOWN")).collect(Collectors.toList());
    }

    @GetMapping("/totals")
    @PreAuthorize("hasAnyRole('SUPERADMIN','CASHIER','ADMINISTRATEUR')")
    public Map<String, Integer> totals(@RequestParam(value = "shiftId", required = false) Long shiftId, @RequestParam(value = "shopId", required = false) Long shopId) {
        List<PaiementClient> payments = (shopId == null) ? paiementClientRepository.findAll() : paiementClientRepository.findByCommandeClientBoutiqueId(shopId);
        // Grouping by dummy method (unknown) - use referenceCaisse if present
        Map<String, Integer> map = payments.stream().collect(Collectors.groupingBy(p -> p.getReferenceCaisse() == null ? "UNKNOWN" : p.getReferenceCaisse(), Collectors.summingInt(p -> p.getMontantPaye() == null ? 0 : p.getMontantPaye())));
        return map;
    }

    public static class PaymentDTO {
        public Long id;
        public String reference;
        public Integer amount;
        public java.time.LocalDateTime date;
        public String paymentMethod;

        public PaymentDTO(Long id, String reference, Integer amount, java.time.LocalDateTime date, String paymentMethod) {
            this.id = id; this.reference = reference; this.amount = amount; this.date = date; this.paymentMethod = paymentMethod;
        }
    }
}
