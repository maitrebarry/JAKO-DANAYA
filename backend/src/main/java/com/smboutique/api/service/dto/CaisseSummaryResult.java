package com.smboutique.api.service.dto;

import java.util.List;

public class CaisseSummaryResult {
    private List<CaisseSummaryItem> items;
    private long totalEntrees;
    private long totalSorties;
    private long net;

    public CaisseSummaryResult(List<CaisseSummaryItem> items, long totalEntrees, long totalSorties) {
        this.items = items;
        this.totalEntrees = totalEntrees;
        this.totalSorties = totalSorties;
        this.net = totalEntrees - totalSorties;
    }

    public List<CaisseSummaryItem> getItems() { return items; }
    public long getTotalEntrees() { return totalEntrees; }
    public long getTotalSorties() { return totalSorties; }
    public long getNet() { return net; }
}
