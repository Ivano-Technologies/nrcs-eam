import WmsReportSuite from "./WmsReportSuite";
import { useFullBleed } from "@/lib/fullBleed";

export default function WmsStockMovementsReport() {
  useFullBleed(true);
  return <WmsReportSuite report="movements" />;
}

