package com.smboutique.api.service;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

public interface PdfService {
    void writeCommandePdf(Long commandeId, HttpServletResponse response) throws IOException;
    void writeCommandeClientPdf(Long commandeId, HttpServletResponse response) throws IOException;
    void writeReceptionPdf(Long receptionId, HttpServletResponse response) throws IOException;
    void writePaiementPdf(Long paiementId, HttpServletResponse response) throws IOException;
    void writePaiementClientPdf(Long paiementId, HttpServletResponse response) throws IOException;
    // Write a PDF for a caisse transaction (when not linked to a paiement)
    void writeCaisseTransactionPdf(Long transactionId, HttpServletResponse response) throws IOException;
    void writeLivraisonPdf(Long livraisonId, HttpServletResponse response) throws IOException;
    void writeDepensePdf(Long depenseId, HttpServletResponse response) throws IOException;
    // Write a PDF for a cash sale (Vente)
    void writeVentePdf(Long venteId, jakarta.servlet.http.HttpServletResponse response) throws IOException;
    // Write a PDF for an Inventaire
    void writeInventairePdf(Long inventaireId, jakarta.servlet.http.HttpServletResponse response) throws IOException;
}
