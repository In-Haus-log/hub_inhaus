import {
  ChartColumn,
  ChartLine,
  ChartPie,
  ClipboardCheck,
  Factory,
  LayoutDashboard,
  Package,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { ICONE_BI_PADRAO } from "@/lib/powerbi-icones"

const icones: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "chart-column": ChartColumn,
  "chart-line": ChartLine,
  "chart-pie": ChartPie,
  package: Package,
  truck: Truck,
  warehouse: Warehouse,
  wrench: Wrench,
  "clipboard-check": ClipboardCheck,
  wallet: Wallet,
  users: Users,
  factory: Factory,
}

export function iconeDoBi(valor?: string | null): LucideIcon {
  return valor && Object.prototype.hasOwnProperty.call(icones, valor) ? icones[valor] : icones[ICONE_BI_PADRAO]
}
