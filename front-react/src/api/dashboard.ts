// Dashboard API disabled — archived in src/archive/dashboard/api_dashboard.ts
export type WidgetDTO = { key: string; permission?: string; data?: any };
export type SectionDTO = { role: string; widgets: WidgetDTO[]; shops?: { id?: number; nom?: string }[] };

export type DashboardPayload = { sections?: SectionDTO[]; currentBoutique?: { id?: number; nom?: string } };
export type ShopOverviewDTO = { salesTotal?: number; sales7d?: number[]; pendingOrders?: number; topProducts?: { id?: number; name?: string; sold?: number }[] };

export async function fetchDashboard(_shopId?: number): Promise<DashboardPayload> {
  throw new Error('Dashboard API disabled (archived)');
}

export async function fetchShopOverview(_shopId: number): Promise<ShopOverviewDTO> {
  throw new Error('Dashboard API disabled (archived)');
}
