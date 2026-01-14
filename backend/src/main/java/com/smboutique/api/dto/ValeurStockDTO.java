package com.smboutique.api.dto;

import java.math.BigDecimal;
import java.util.List;

public class ValeurStockDTO {
    private BigDecimal valeurTotale;
    private List<StockReportItemDTO> details;

    public ValeurStockDTO() {}

    public BigDecimal getValeurTotale() {
        return valeurTotale;
    }

    public void setValeurTotale(BigDecimal valeurTotale) {
        this.valeurTotale = valeurTotale;
    }

    public List<StockReportItemDTO> getDetails() {
        return details;
    }

    public void setDetails(List<StockReportItemDTO> details) {
        this.details = details;
    }
}