package com.smboutique.api.service;

import com.smboutique.api.model.Utilisateur;

import java.util.List;
import java.util.Map;

public interface SubscriptionPaymentService {
    List<Map<String, Object>> listPaymentsForUser(Utilisateur user);
    List<Map<String, Object>> listPaymentsForAdmin(String status);
    Map<String, Object> initiatePayment(Utilisateur user, String planCode, String provider);
    Map<String, Object> submitManualPayment(Utilisateur user, String planCode, String modePaiement, String transactionRef, String ownerNote, String preuveUrl);
    Map<String, Object> simulateSuccess(Utilisateur user, Long paymentId);
    Map<String, Object> rejectPayment(Utilisateur user, Long paymentId, String reason);
}
