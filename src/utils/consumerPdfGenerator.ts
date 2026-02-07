/**
 * Consumer PDF Generator
 * 
 * Generates a clean, branded, print-ready PDF itinerary.
 * Designed for travelers to carry on their trip.
 */

import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { EditorialDay, EditorialActivity } from '@/components/itinerary/EditorialItinerary';

export interface ConsumerTripPdfData {
  tripName?: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  days?: EditorialDay[];
  flight?: {
    airline: string;
    departure: string;
    arrival: string;
    departureAirport: string;
    arrivalAirport: string;
  };
  hotel?: {
    name: string;
    neighborhood: string;
    checkIn: string;
    checkOut: string;
  };
}

// Refined color palette
const C = {
  black: [20, 20, 30] as [number, number, number],
  dark: [40, 45, 55] as [number, number, number],
  body: [55, 60, 70] as [number, number, number],
  muted: [120, 125, 135] as [number, number, number],
  light: [200, 200, 205] as [number, number, number],
  bg: [245, 246, 248] as [number, number, number],
  accent: [79, 70, 229] as [number, number, number],      // Indigo-600
  accentLight: [224, 221, 255] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export async function generateConsumerTripPdf(data: ConsumerTripPdfData): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = pdf.internal.pageSize.getWidth();   // 210
  const H = pdf.internal.pageSize.getHeight();   // 297
  const M = 18; // margin
  const CW = W - M * 2; // content width
  let y = 0;
  let pageNum = 0;

  // ── Helpers ──────────────────────────────────────────────────────
  const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color = C.dark) => {
    pdf.setFontSize(size);
    pdf.setFont('helvetica', style);
    pdf.setTextColor(...color);
  };

  const text = (t: string, x: number, yy: number, opts?: { align?: 'left' | 'center' | 'right'; maxWidth?: number }) => {
    if (opts?.maxWidth) {
      const lines = pdf.splitTextToSize(t, opts.maxWidth);
      pdf.text(lines, x, yy, { align: opts.align });
      return lines.length;
    }
    pdf.text(t, x, yy, { align: opts?.align });
    return 1;
  };

  const line = (x1: number, yy: number, x2: number, color = C.light, width = 0.3) => {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(width);
    pdf.line(x1, yy, x2, yy);
  };

  const newPage = () => {
    pdf.addPage();
    pageNum++;
    y = M;
  };

  const needsBreak = (space: number) => {
    if (y + space > H - 20) {
      newPage();
      return true;
    }
    return false;
  };

  const addFooters = () => {
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      setFont(7, 'normal', C.muted);
      pdf.text(`Voyance`, M, H - 8);
      pdf.text(`${i} / ${total}`, W - M, H - 8, { align: 'right' });
      line(M, H - 12, W - M, C.bg);
    }
  };

  const fmtDate = (s: string) => { try { return format(new Date(s), 'EEE, MMM d'); } catch { return s; } };
  const fmtDateLong = (s: string) => { try { return format(new Date(s), 'EEEE, MMMM d, yyyy'); } catch { return s; } };

  const getCategoryIcon = (cat?: string): string => {
    const icons: Record<string, string> = {
      food: '🍽', restaurant: '🍽', dining: '🍽',
      culture: '🏛', museum: '🏛', history: '🏛',
      nature: '🌿', outdoors: '🌿', park: '🌿',
      shopping: '🛍', market: '🛍',
      nightlife: '🌙', bar: '🌙',
      transport: '🚌', transit: '🚌',
      hotel: '🏨', accommodation: '🏨',
      flight: '✈',
      beach: '🏖', 
      activity: '⭐', tour: '⭐', experience: '⭐',
    };
    if (!cat) return '•';
    const key = cat.toLowerCase();
    return icons[key] || '•';
  };

  // ── COVER PAGE ──────────────────────────────────────────────────
  pageNum = 1;

  // Top accent bar
  pdf.setFillColor(...C.accent);
  pdf.rect(0, 0, W, 3, 'F');

  // Destination title
  y = 70;
  setFont(32, 'bold', C.black);
  text(data.destination, W / 2, y, { align: 'center' });

  // Trip name (if different)
  if (data.tripName && data.tripName !== data.destination && !data.tripName.includes(data.destination)) {
    y += 14;
    setFont(13, 'normal', C.muted);
    text(data.tripName, W / 2, y, { align: 'center' });
  }

  // Date range
  y += 16;
  setFont(12, 'normal', C.body);
  const dateStr = `${fmtDateLong(data.startDate)}  –  ${fmtDateLong(data.endDate)}`;
  text(dateStr, W / 2, y, { align: 'center' });

  // Travelers
  y += 8;
  setFont(10, 'normal', C.muted);
  text(`${data.travelers} traveler${data.travelers !== 1 ? 's' : ''}`, W / 2, y, { align: 'center' });

  // Divider
  y += 20;
  line(W / 2 - 20, y, W / 2 + 20, C.light, 0.5);

  // Quick reference box
  y += 15;
  const hasBookings = data.flight || data.hotel;
  if (hasBookings) {
    pdf.setFillColor(...C.bg);
    pdf.roundedRect(M + 10, y - 5, CW - 20, data.flight && data.hotel ? 42 : 22, 3, 3, 'F');

    if (data.flight) {
      setFont(8, 'bold', C.muted);
      text('FLIGHT', M + 18, y + 2);
      setFont(10, 'normal', C.dark);
      text(`${data.flight.airline}  ·  ${data.flight.departureAirport} → ${data.flight.arrivalAirport}`, M + 18, y + 9);
      setFont(9, 'normal', C.muted);
      text(`Departs ${data.flight.departure}  ·  Arrives ${data.flight.arrival}`, M + 18, y + 16);
      y += 22;
    }

    if (data.hotel) {
      setFont(8, 'bold', C.muted);
      text('HOTEL', M + 18, y + 2);
      setFont(10, 'normal', C.dark);
      text(`${data.hotel.name}  ·  ${data.hotel.neighborhood}`, M + 18, y + 9);
      setFont(9, 'normal', C.muted);
      text(`${data.hotel.checkIn} – ${data.hotel.checkOut}`, M + 18, y + 16);
      y += 22;
    }
  }

  // Footer text on cover
  setFont(8, 'normal', C.muted);
  text('Generated by Voyance  ·  travelwithvoyance.com', W / 2, H - 20, { align: 'center' });

  // ── ITINERARY PAGES ─────────────────────────────────────────────
  if (data.days && data.days.length > 0) {
    newPage();

    // Section title
    setFont(18, 'bold', C.black);
    text('Your Itinerary', M, y + 4);
    y += 12;
    line(M, y, W - M, C.accent, 0.8);
    y += 10;

    for (const day of data.days) {
      needsBreak(45);

      // Day header bar
      pdf.setFillColor(...C.accent);
      pdf.roundedRect(M, y - 1, CW, 12, 2, 2, 'F');

      setFont(11, 'bold', C.white);
      const dayLabel = `Day ${day.dayNumber}`;
      text(dayLabel, M + 5, y + 7);

      if (day.title || day.theme) {
        setFont(10, 'normal', C.accentLight);
        text(day.title || day.theme || '', M + 30, y + 7);
      }

      if (day.date) {
        setFont(9, 'normal', C.accentLight);
        text(fmtDate(day.date), W - M - 5, y + 7, { align: 'right' });
      }

      y += 17;

      // Activities
      if (day.activities && day.activities.length > 0) {
        for (const act of day.activities) {
          needsBreak(22);

          const timeStr = act.startTime || act.time || '';
          const icon = getCategoryIcon(act.category || act.type);
          const locationName = act.location?.name || act.location?.address;

          // Time column
          if (timeStr) {
            setFont(9, 'bold', C.accent);
            text(timeStr, M + 2, y);
          }

          const xContent = M + (timeStr ? 22 : 5);

          // Activity title
          setFont(10, 'bold', C.dark);
          text(`${icon}  ${act.title}`, xContent, y);
          y += 5;

          // Description (1 line max for clean look)
          if (act.description) {
            setFont(8.5, 'normal', C.body);
            const descLines = pdf.splitTextToSize(act.description, CW - (timeStr ? 26 : 8));
            pdf.text(descLines.slice(0, 2), xContent, y);
            y += Math.min(descLines.length, 2) * 3.5;
          }

          // Location + Duration row
          const metaParts: string[] = [];
          if (locationName) metaParts.push(`📍 ${locationName}`);
          if (act.duration) metaParts.push(`⏱ ${act.duration}`);
          if (act.cost?.amount) metaParts.push(`${act.cost.currency || '$'}${act.cost.amount}`);

          if (metaParts.length > 0) {
            setFont(7.5, 'normal', C.muted);
            text(metaParts.join('   ·   '), xContent, y);
            y += 3.5;
          }

          // Tips
          if (act.tips) {
            setFont(7.5, 'normal', C.accent);
            const tipLines = pdf.splitTextToSize(`💡 ${act.tips}`, CW - (timeStr ? 26 : 8));
            pdf.text(tipLines.slice(0, 1), xContent, y);
            y += 3.5;
          }

          y += 4; // spacing between activities

          // Light separator
          line(xContent, y - 2, W - M, C.bg, 0.2);
        }
      } else {
        setFont(9, 'normal', C.muted);
        text('Free day — explore at your own pace', M + 5, y);
        y += 6;
      }

      y += 6; // spacing between days
    }
  }

  // ── NOTES PAGE (optional) ───────────────────────────────────────
  newPage();
  setFont(16, 'bold', C.black);
  text('Notes', M, y + 4);
  y += 10;
  line(M, y, W - M, C.light, 0.3);
  y += 8;

  // Ruled lines for handwritten notes
  for (let i = 0; i < 25; i++) {
    line(M, y, W - M, C.bg, 0.15);
    y += 9;
  }

  // ── Footers ─────────────────────────────────────────────────────
  addFooters();

  // ── Save ────────────────────────────────────────────────────────
  const safeName = (data.tripName || data.destination).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  pdf.save(`${safeName}-itinerary.pdf`);
}
