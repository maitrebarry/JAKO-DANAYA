package com.smboutique.api.service.dto;

public class CaisseSummaryItem {
    private String period;
    private long totalEntrees;
    private long totalSorties;
    private long net;

    public CaisseSummaryItem(String period, long totalEntrees, long totalSorties) {
        this.period = period;
        this.totalEntrees = totalEntrees;
        this.totalSorties = totalSorties;
        this.net = totalEntrees - totalSorties;
    }

    public String getPeriod() { return period; }
    public long getTotalEntrees() { return totalEntrees; }
    public long getTotalSorties() { return totalSorties; }
    public long getNet() { return net; }
}
