import { useMemo, useState } from "react";
import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";

interface AirlineLogoProps {
  code: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Airline code to name mapping for common airlines
const airlineNames: Record<string, string> = {
  AA: "American Airlines",
  DL: "Delta Air Lines",
  UA: "United Airlines",
  WN: "Southwest Airlines",
  B6: "JetBlue Airways",
  AS: "Alaska Airlines",
  NK: "Spirit Airlines",
  F9: "Frontier Airlines",
  G4: "Allegiant Air",
  HA: "Hawaiian Airlines",
  BA: "British Airways",
  AF: "Air France",
  LH: "Lufthansa",
  KL: "KLM Royal Dutch",
  LX: "Swiss International",
  AZ: "ITA Airways",
  IB: "Iberia",
  EK: "Emirates",
  QR: "Qatar Airways",
  EY: "Etihad Airways",
  TK: "Turkish Airlines",
  SQ: "Singapore Airlines",
  CX: "Cathay Pacific",
  JL: "Japan Airlines",
  NH: "All Nippon Airways",
  QF: "Qantas",
  AC: "Air Canada",
  AM: "Aeromexico",
  VS: "Virgin Atlantic",
  LA: "LATAM Airlines",
  AV: "Avianca",
  CM: "Copa Airlines",
  SK: "SAS Scandinavian",
  AY: "Finnair",
  OS: "Austrian Airlines",
  SN: "Brussels Airlines",
  TP: "TAP Portugal",
  EI: "Aer Lingus",
  FR: "Ryanair",
  U2: "easyJet",
  W6: "Wizz Air",
  VY: "Vueling",
  KE: "Korean Air",
  OZ: "Asiana Airlines",
  CI: "China Airlines",
  BR: "EVA Air",
  MH: "Malaysia Airlines",
  TG: "Thai Airways",
  GA: "Garuda Indonesia",
  MU: "China Eastern",
  CA: "Air China",
  CZ: "China Southern",
  HU: "Hainan Airlines",
  AI: "Air India",
  ET: "Ethiopian Airlines",
  MS: "EgyptAir",
  RJ: "Royal Jordanian",
  SV: "Saudia",
  GF: "Gulf Air",
  WY: "Oman Air",
  FZ: "flydubai",
  LY: "El Al",
  SA: "South African Airways",
  NZ: "Air New Zealand",
  VA: "Virgin Australia",
  JQ: "Jetstar",
  PR: "Philippine Airlines",
  VN: "Vietnam Airlines",
};

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

function normalizeAirlineCode(raw: string): string {
  const upper = (raw || "").toUpperCase().trim();
  // Accept typical IATA (2 chars) / ICAO (3 chars)
  const token = upper.split(" ")[0];
  const cleaned = token.replace(/[^A-Z0-9]/g, "");
  if (cleaned.length === 2 || cleaned.length === 3) return cleaned;
  return "";
}

export default function AirlineLogo({ code, name, size = "md", className }: AirlineLogoProps) {
  const [imageError, setImageError] = useState(false);

  const normalizedCode = useMemo(() => normalizeAirlineCode(code), [code]);
  const airlineName = name || airlineNames[normalizedCode] || code;

  // Kiwi.com CDN for airline logos
  const logoUrl = normalizedCode
    ? `https://images.kiwi.com/airlines/64/${normalizedCode}.png`
    : "";

  if (imageError || !normalizedCode) {
    return (
      <div
        className={cn(
          "rounded-lg flex items-center justify-center font-bold",
          "bg-gradient-to-br from-primary to-accent text-primary-foreground",
          sizeClasses[size],
          className
        )}
        title={airlineName}
      >
        {normalizedCode ? (
          <span className={size === "sm" ? "text-xs" : "text-sm"}>{normalizedCode}</span>
        ) : (
          <Plane className={size === "sm" ? "w-4 h-4" : "w-5 h-5"} />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg bg-background border border-border flex items-center justify-center p-1.5",
        sizeClasses[size],
        className
      )}
      title={airlineName}
    >
      <img
        src={logoUrl}
        alt={airlineName}
        className="w-full h-full object-contain"
        loading="lazy"
        onError={() => setImageError(true)}
      />
    </div>
  );
}

export function getAirlineName(code: string): string {
  return airlineNames[normalizeAirlineCode(code)] || code;
}
