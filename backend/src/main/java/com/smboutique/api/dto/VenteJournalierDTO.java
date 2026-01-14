package com.smboutique.api.dto;

import java.time.LocalDate;

public class VenteJournalierDTO {
    private LocalDate date;
    private long nombreVentes;
    private long montantTotal;

    public VenteJournalierDTO() {}

    public VenteJournalierDTO(LocalDate date, long nombreVentes, long montantTotal) {
        this.date = date;
        this.nombreVentes = nombreVentes;
        this.montantTotal = montantTotal;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public long getNombreVentes() {
        return nombreVentes;
    }

    public void setNombreVentes(long nombreVentes) {
        this.nombreVentes = nombreVentes;
    }

    public long getMontantTotal() {
        return montantTotal;
    }

    public void setMontantTotal(long montantTotal) {
        this.montantTotal = montantTotal;
    }
}