package com.smboutique.api.service;

import com.smboutique.api.model.Mouvement;
import java.util.List;

public class MouvementSearchResult {
    private List<Mouvement> items;
    private long total;

    public MouvementSearchResult() {}

    public MouvementSearchResult(List<Mouvement> items, long total) {
        this.items = items;
        this.total = total;
    }

    public List<Mouvement> getItems() {
        return items;
    }

    public void setItems(List<Mouvement> items) {
        this.items = items;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }
}
