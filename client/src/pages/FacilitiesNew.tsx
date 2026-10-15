import { useEffect } from "react";
import { useLocation } from "wouter";
import { appPath } from "@/lib/routes";

/** Legacy `/facilities/new?type=`: the Add dialog now opens in place on the list (`?new=1`). */
export default function FacilitiesNew() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("new", "1");
    setLocation(`${appPath("/facilities/all")}?${params.toString()}`, { replace: true });
  }, [setLocation]);
  return null;
}
