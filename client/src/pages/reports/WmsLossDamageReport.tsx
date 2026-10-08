import WmsReportSuite from "./WmsReportSuite";
import { useFullBleed } from "@/lib/fullBleed";

export default function WmsLossDamageReport() {
  useFullBleed(true);
  return <WmsReportSuite report="loss" />;
}

