import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { EditorialDay, EditorialActivity } from '@/components/itinerary/EditorialItinerary';
import { cleanSystemAnnotations } from '@/utils/textSanitizer';

/**
 * Trip PDF Generator for Travel Agents
 * Generates a branded, client-ready PDF with trip details and itinerary
 */

export interface TripPdfData {
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelerCount: number;
  clientName?: string;
  notes?: string;
  days: EditorialDay[];
  bookings?: BookingItem[];
  branding: AgentBranding;
  /** Day numbers that are unlocked. If provided, locked days are redacted. */
  unlockedDayNumbers?: Set<number>;
}

export interface BookingItem {
  type: 'flight' | 'hotel' | 'tour' | 'transfer' | 'car_rental' | 'other';
  vendorName?: string;
  confirmationNumber?: string;
  details?: string;
  startDate?: string;
  endDate?: string;
}

export interface AgentBranding {
  businessName: string;
  email?: string;
  phone?: string;
  website?: string;
  tagline?: string;
}

// Color constants (RGB)
const COLORS = {
  primary: [99, 102, 241] as [number, number, number],     // Indigo
  secondary: [236, 72, 153] as [number, number, number],   // Pink  
  dark: [30, 41, 59] as [number, number, number],          // Slate 800
  muted: [100, 116, 139] as [number, number, number],      // Slate 500
  light: [241, 245, 249] as [number, number, number],      // Slate 100
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
};

export async function generateTripPdf(data: TripPdfData): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper functions
  const addText = (
    text: string, 
    fontSize: number, 
    fontStyle: 'normal' | 'bold' = 'normal', 
    color: [number, number, number] = COLORS.dark
  ) => {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', fontStyle);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, contentWidth);
    pdf.text(lines, margin, y);
    y += lines.length * (fontSize * 0.4) + 3;
  };

  const addCenteredText = (
    text: string,
    fontSize: number,
    fontStyle: 'normal' | 'bold' = 'normal',
    color: [number, number, number] = COLORS.dark
  ) => {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', fontStyle);
    pdf.setTextColor(...color);
    pdf.text(text, pageWidth / 2, y, { align: 'center' });
    y += fontSize * 0.4 + 3;
  };

  const checkPageBreak = (neededSpace: number = 30) => {
    if (y > pageHeight - neededSpace) {
      pdf.addPage();
      y = margin;
      addFooter();
    }
  };

  const addFooter = () => {
    const footerY = pageHeight - 10;
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(
      `Prepared by ${data.branding.businessName}${data.branding.email ? ` • ${data.branding.email}` : ''}`,
      margin,
      footerY
    );
    pdf.text(
      `Page ${pdf.getNumberOfPages()}`,
      pageWidth - margin,
      footerY,
      { align: 'right' }
    );
  };

  const addSection = (title: string) => {
    checkPageBreak(40);
    y += 6;
    pdf.setFillColor(...COLORS.primary);
    pdf.rect(margin, y - 4, 3, 12, 'F');
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.dark);
    pdf.text(title, margin + 8, y + 4);
    y += 16;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  // ==========================================
  // COVER PAGE
  // ==========================================
  
  // Header band
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 0, pageWidth, 70, 'F');
  
  // Agent branding
  pdf.setTextColor(...COLORS.white);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.branding.businessName.toUpperCase(), pageWidth / 2, 20, { align: 'center' });
  
  if (data.branding.tagline) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(data.branding.tagline, pageWidth / 2, 28, { align: 'center' });
  }

  // Trip title
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.tripName, pageWidth / 2, 50, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.destination, pageWidth / 2, 62, { align: 'center' });

  y = 90;

  // Trip details card
  pdf.setFillColor(...COLORS.light);
  pdf.roundedRect(margin, y - 5, contentWidth, 35, 3, 3, 'F');
  
  pdf.setTextColor(...COLORS.muted);
  pdf.setFontSize(9);
  pdf.text('DATES', margin + 10, y + 3);
  pdf.text('TRAVELERS', margin + 70, y + 3);
  if (data.clientName) {
    pdf.text('PREPARED FOR', margin + 130, y + 3);
  }
  
  pdf.setTextColor(...COLORS.dark);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  const dateRange = `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`;
  pdf.text(dateRange, margin + 10, y + 14);
  pdf.text(`${data.travelerCount} ${data.travelerCount === 1 ? 'traveler' : 'travelers'}`, margin + 70, y + 14);
  if (data.clientName) {
    pdf.text(data.clientName, margin + 130, y + 14);
  }

  y += 50;

  // Notes
  if (data.notes) {
    addSection('Trip Notes');
    pdf.setFont('helvetica', 'normal');
    addText(data.notes, 10, 'normal', COLORS.muted);
  }

  // ==========================================
  // BOOKINGS SUMMARY
  // ==========================================
  
  if (data.bookings && data.bookings.length > 0) {
    addSection('Confirmed Bookings');
    
    data.bookings.forEach((booking, index) => {
      checkPageBreak(25);
      
      // Booking type label
      const typeLabels: Record<string, string> = {
        flight: '✈️ Flight',
        hotel: '🏨 Hotel',
        tour: '🎯 Tour',
        transfer: '🚗 Transfer',
        car_rental: '🚙 Car Rental',
        other: '📋 Other',
      };
      
      pdf.setFillColor(...COLORS.light);
      pdf.roundedRect(margin, y - 3, contentWidth, 20, 2, 2, 'F');
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...COLORS.dark);
      pdf.text(typeLabels[booking.type] || booking.type, margin + 5, y + 5);
      
      if (booking.vendorName) {
        pdf.setFont('helvetica', 'normal');
        pdf.text(`• ${booking.vendorName}`, margin + 35, y + 5);
      }
      
      if (booking.confirmationNumber) {
        pdf.setTextColor(...COLORS.primary);
        pdf.text(`Conf: ${booking.confirmationNumber}`, pageWidth - margin - 5, y + 5, { align: 'right' });
      }
      
      if (booking.details) {
        pdf.setFontSize(9);
        pdf.setTextColor(...COLORS.muted);
        pdf.text(booking.details, margin + 5, y + 13);
      }
      
      y += 25;
    });
  }

  // ==========================================
  // DAY-BY-DAY ITINERARY
  // ==========================================
  
  if (data.days && data.days.length > 0) {
    pdf.addPage();
    y = margin;
    
    addCenteredText('Your Day-by-Day Itinerary', 18, 'bold', COLORS.dark);
    y += 10;
    
    data.days.forEach((day) => {
      checkPageBreak(50);
      
      // Check if this day is locked
      const isDayLocked = data.unlockedDayNumbers && !data.unlockedDayNumbers.has(day.dayNumber);
      
      // Day header
      pdf.setFillColor(...(isDayLocked ? COLORS.muted : COLORS.primary));
      pdf.roundedRect(margin, y - 3, contentWidth, 18, 2, 2, 'F');
      
      pdf.setTextColor(...COLORS.white);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      
      const dayLabel = `Day ${day.dayNumber}`;
      const dayDate = day.date ? ` • ${formatDate(day.date)}` : '';
      pdf.text(dayLabel + dayDate, margin + 5, y + 7);
      
      if (day.title || day.theme) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(day.title || day.theme || '', pageWidth - margin - 5, y + 7, { align: 'right' });
      }
      
      y += 22;
      
      if (isDayLocked) {
        // Locked day — redacted placeholder
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...COLORS.muted);
        pdf.text('🔒 Day ' + day.dayNumber + ' is locked', margin + 5, y);
        y += 6;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Unlock this day at travelwithvoyance.com to see full details', margin + 5, y);
        y += 10;
      } else if (day.activities && day.activities.length > 0) {
        // Activities
        day.activities.forEach((activity) => {
          checkPageBreak(25);
          
          const timeStr = activity.startTime || activity.time || '';
          if (timeStr) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...COLORS.primary);
            pdf.text(timeStr, margin, y);
          }
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...COLORS.dark);
          pdf.text(activity.title, margin + (timeStr ? 25 : 0), y);
          
          y += 5;
          
          if (activity.description) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...COLORS.muted);
            const descLines = pdf.splitTextToSize(activity.description, contentWidth - 25);
            pdf.text(descLines.slice(0, 2), margin + (timeStr ? 25 : 0), y);
            y += Math.min(descLines.length, 2) * 4;
          }
          
          if (activity.location?.name || activity.location?.address) {
            pdf.setFontSize(8);
            pdf.setTextColor(...COLORS.muted);
            const locText = activity.location.name || activity.location.address || '';
            pdf.text(`📍 ${locText}`, margin + (timeStr ? 25 : 0), y);
            y += 4;
          }
          
          y += 6;
        });
      } else {
        pdf.setFontSize(9);
        pdf.setTextColor(...COLORS.muted);
        pdf.text('No activities planned for this day', margin + 5, y);
        y += 10;
      }
      
      y += 8;
    });
  }

  // ==========================================
  // CONTACT PAGE
  // ==========================================
  
  pdf.addPage();
  y = pageHeight / 2 - 30;
  
  addCenteredText('Questions or Changes?', 16, 'bold', COLORS.dark);
  y += 5;
  addCenteredText('Contact your travel advisor:', 11, 'normal', COLORS.muted);
  y += 15;
  
  addCenteredText(data.branding.businessName, 14, 'bold', COLORS.primary);
  
  if (data.branding.email) {
    y += 3;
    addCenteredText(data.branding.email, 11, 'normal', COLORS.dark);
  }
  if (data.branding.phone) {
    y += 3;
    addCenteredText(data.branding.phone, 11, 'normal', COLORS.dark);
  }
  if (data.branding.website) {
    y += 3;
    addCenteredText(data.branding.website, 11, 'normal', COLORS.primary);
  }
  
  y += 20;
  addCenteredText('Thank you for trusting us with your travel plans!', 10, 'normal', COLORS.muted);

  // Add footers to all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter();
  }

  // Save the PDF
  const fileName = `${data.tripName.replace(/[^a-zA-Z0-9]/g, '-')}-Itinerary.pdf`;
  pdf.save(fileName);
}

export default generateTripPdf;
