package com.smboutique.api.service.dto;

public class DashboardOverviewDTO {
    private Long salesTotal;
    private Integer productsCount;
    private Integer clientsCount;
    private Integer suppliersCount;
    private Long salesToday;
    private Long pendingOrders;
    private Long lowStockCount;

    // additional fields used by controller
    private java.util.List<Long> sales7d;
    private java.util.List<TopProductDTO> topProducts;

    public Long getSalesTotal() { return salesTotal; }
    public void setSalesTotal(Long salesTotal) { this.salesTotal = salesTotal; }

    public Integer getProductsCount() { return productsCount; }
    public void setProductsCount(Integer productsCount) { this.productsCount = productsCount; }

    public Integer getClientsCount() { return clientsCount; }
    public void setClientsCount(Integer clientsCount) { this.clientsCount = clientsCount; }

    public Integer getSuppliersCount() { return suppliersCount; }
    public void setSuppliersCount(Integer suppliersCount) { this.suppliersCount = suppliersCount; }

    public Long getSalesToday() { return salesToday; }
    public void setSalesToday(Long salesToday) { this.salesToday = salesToday; }

    public Long getPendingOrders() { return pendingOrders; }
    public void setPendingOrders(Long pendingOrders) { this.pendingOrders = pendingOrders; }

    public Long getLowStockCount() { return lowStockCount; }
    public void setLowStockCount(Long lowStockCount) { this.lowStockCount = lowStockCount; }

    public java.util.List<Long> getSales7d() { return sales7d; }
    public void setSales7d(java.util.List<Long> sales7d) { this.sales7d = sales7d; }

    public java.util.List<TopProductDTO> getTopProducts() { return topProducts; }
    public void setTopProducts(java.util.List<TopProductDTO> topProducts) { this.topProducts = topProducts; }

    public static class TopProductDTO {
        private Long id;
        private String name;
        private Long sold;
        public TopProductDTO() {}
        public TopProductDTO(Long id, String name, Long sold) { this.id = id; this.name = name; this.sold = sold; }
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public Long getSold() { return sold; }
        public void setSold(Long sold) { this.sold = sold; }
    }
}
