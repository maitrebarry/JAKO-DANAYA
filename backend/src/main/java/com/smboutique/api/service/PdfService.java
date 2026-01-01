package com.smboutique.api.service;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

public interface PdfService {
    void writeCommandePdf(Long commandeId, HttpServletResponse response) throws IOException;
    void writeCommandeClientPdf(Long commandeId, HttpServletResponse response) throws IOException;
    void writeReceptionPdf(Long receptionId, HttpServletResponse response) throws IOException;
    void writePaiementPdf(Long paiementId, HttpServletResponse response) throws IOException;
    void writePaiementClientPdf(Long paiementId, HttpServletResponse response) throws IOException;
    void writeLivraisonPdf(Long livraisonId, HttpServletResponse response) throws IOException;
    void writeDepensePdf(Long depenseId, HttpServletResponse response) throws IOException;
}
