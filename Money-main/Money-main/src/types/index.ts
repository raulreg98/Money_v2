export interface Product {
  id: number;
  name: string;
  type: string;
  isin: string | null;
  ticker: string | null;
  currency: string;
  price_source: string | null;
  ter: number | null;
  risk: number | null;
  category: string | null;
  manual_price: number;
  long_term: number;
  archived: number;
  created_at: string;
  updated_at: string;
  alt_source: string | null;
  alt_symbol: string | null;
}

export interface Movement {
  id: number;
  product_id: number;
  type: string;
  date: string;
  units: number | null;
  amount_eur: number;
  fee: number | null;
  note: string | null;
  portfolio: string | null;
  created_at: string;
}

export interface PriceRow {
  id: number;
  product_id: number;
  price: number;
  currency: string;
  source: string | null;
  date: string;
}

export interface ValuationRow {
  id: number;
  product_id: number;
  value_eur: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface Account {
  id: number;
  name: string;
  currency: string;
  initial_balance: number;
  color: string;
  type: string;
  archived: number;
  exclude_from_net_worth: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  type: string;
  date: string;
  amount: number;
  account_id: number;
  to_account_id: number | null;
  to_amount: number | null;
  note: string | null;
  tags: string | null;
  category_id: number | null;
  linked_transfer_id: number | null;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  parent_id: number | null;
  created_at: string;
}

export interface ChartWidget {
  id: number;
  name: string;
  chart_type: string;
  metric: string;
  group_by: string;
  period: string;
  custom_from: string | null;
  custom_to: string | null;
  account_filter: string | null;
  tag_filter: string | null;
  pinned: number;
  sort_order: number;
  created_at: string;
  default_key: string | null;
  size: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalGain: number;
  tir: number | null;
  totalReturnPct: number;
  byType: Record<string, { value: number; invested: number }>;
  productDetails: ProductDetail[];
  longTermOnly: boolean;
}

export interface ProductDetail {
  id: number;
  name: string;
  type: string;
  value: number;
  invested: number;
  gain: number;
  units: number;
  averageCost: number;
  price: number | null;
  priceDate: string | null;
  priceSource: string | null;
  hasPrice: boolean;
  estimated: boolean;
  priceAgeDays: number | null;
  longTerm: boolean;
}

export interface ProductDetailFull {
  product: Product;
  movements: Movement[];
  currentValue: number;
  invested: number;
  gain: number;
  returnPct: number;
  tir: number | null;
  units: number;
  averageCost: number;
  realizedGain: number;
  latestPrice: PriceRow | null;
  latestValuation: ValuationRow | null;
  priceHistory: { date: string; price: number }[];
  series: { date: string; value: number }[];
  maxDrawdown: number;
  volatility: number;
  sharpe: number;
  hasPrice: boolean;
  estimated: boolean;
  pricePerUnit: number | null;
  priceDate: string | null;
  priceSource: string | null;
  priceAgeDays: number | null;
}

export interface ComparatorResult {
  name: string;
  currentValue: number;
  invested: number;
  gain: number;
  returnPct: number;
  xirr: number | null;
  volatility: number;
  sharpe: number;
  maxDrawdown: number;
  series: { date: string; value: number }[];
}

export interface DashboardData {
  netWorth: number;
  investmentValue: number;
  accountsBalance: number;
  pinnedWidgets: number[];
}

export interface SearchResult {
  name: string;
  type: string;
  ticker: string;
  isin: string | null;
  currency: string;
  source: string;
  coinId?: string;
}
