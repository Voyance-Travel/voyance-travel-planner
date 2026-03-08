import jsPDF from 'jspdf';
import { CONTACT_CONFIG } from '@/config/contact';

/**
 * Voyance Press Kit Generator
 * Generates a downloadable PDF press kit with company information
 */

// Company facts and information
export const companyInfo = {
  name: 'Voyance',
  tagline: 'AI-Powered Travel Planning',
  founded: '2025',
  headquarters: 'Atlanta, GA',
  website: 'https://travelwithvoyance.com',
  mission: 'To revolutionize travel planning by combining artificial intelligence with deep personalization, helping every traveler discover experiences that resonate with who they are.',
  vision: 'A world where every journey is perfectly tailored to the individual, making travel more accessible, meaningful, and memorable for everyone.',
};

export const keyStats = [
  { label: 'Curated Destinations', value: '500+' },
  { label: 'Travel DNA Types', value: '29' },
  { label: 'Personalization Signals', value: '50+' },
  { label: 'AI Itinerary Engines', value: '3' },
];

export const platformCapabilities = [
  'Unique itineraries generated from 29 distinct Travel DNA profiles',
  'Multi-factor personalization using 50+ preference signals',
  'Day-by-day activity scheduling with time-optimized routing',
  'Flight and hotel booking integration',
  'Adaptive recommendations based on budget, pace, and interests',
  'Destination matching using proprietary scoring algorithms',
];

export const leadership: { name: string; title: string; bio: string }[] = [];

export const pressHighlights: string[] = [];

export const brandGuidelines = {
  primaryColor: '#6366F1', // Indigo
  accentColor: '#EC4899', // Pink
  fonts: {
    display: 'Playfair Display',
    body: 'Inter',
  },
  usage: [
    'Always use the official Voyance logo',
    'Maintain minimum clear space around the logo',
    'Do not distort, rotate, or alter the logo colors',
    'Use the wordmark on light backgrounds, inverted on dark',
  ],
};

/**
 * Generate and download the press kit PDF
 */
export async function generatePressKitPDF(): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper function for adding text
  const addText = (text: string, fontSize: number, fontStyle: 'normal' | 'bold' = 'normal', color: [number, number, number] = [0, 0, 0]) => {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', fontStyle);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, contentWidth);
    pdf.text(lines, margin, y);
    y += lines.length * (fontSize * 0.4) + 4;
  };

  const addSection = (title: string) => {
    if (y > 250) {
      pdf.addPage();
      y = margin;
    }
    y += 8;
    addText(title, 16, 'bold', [99, 102, 241]);
    y += 2;
  };

  const addDivider = () => {
    pdf.setDrawColor(200);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;
  };

  // Title Page
  pdf.setFillColor(99, 102, 241);
  pdf.rect(0, 0, pageWidth, 60, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(32);
  pdf.setFont('helvetica', 'bold');
  pdf.text('VOYANCE', pageWidth / 2, 30, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Press Kit 2026', pageWidth / 2, 42, { align: 'center' });
  
  y = 80;
  pdf.setTextColor(0, 0, 0);

  // Company Overview
  addSection('Company Overview');
  addText(companyInfo.mission, 11);
  y += 4;

  // Quick Facts
  addSection('Quick Facts');
  addText(`Founded: ${companyInfo.founded}`, 11);
  addText(`Headquarters: ${companyInfo.headquarters}`, 11);
  addText(`Website: ${companyInfo.website}`, 11);
  y += 4;

  // Key Statistics
  addSection('Key Statistics');
  keyStats.forEach(stat => {
    addText(`${stat.label}: ${stat.value}`, 11);
  });

  addDivider();

  // Platform Capabilities
  addSection('Platform Capabilities');
  addText('What makes each Voyance itinerary unique:', 11, 'bold');
  y += 2;
  platformCapabilities.forEach(capability => {
    addText(`• ${capability}`, 10);
  });

  // New page for brand guidelines
  pdf.addPage();
  y = margin;

  // Brand Guidelines Summary
  addSection('Brand Guidelines');
  addText('Primary Colors:', 11, 'bold');
  addText(`Primary: ${brandGuidelines.primaryColor} (Indigo)`, 10);
  addText(`Accent: ${brandGuidelines.accentColor} (Pink)`, 10);
  y += 4;
  
  addText('Typography:', 11, 'bold');
  addText(`Display Font: ${brandGuidelines.fonts.display}`, 10);
  addText(`Body Font: ${brandGuidelines.fonts.body}`, 10);
  y += 4;

  addText('Logo Usage Guidelines:', 11, 'bold');
  brandGuidelines.usage.forEach(rule => {
    addText(`• ${rule}`, 10);
  });

  addDivider();

  // Contact Information
  addSection('Media Contact');
  addText('For press inquiries, interviews, or additional materials:', 11);
  y += 2;
  addText('Email: contact@travelwithvoyance.com', 11, 'bold');
  addText('Website: travelwithvoyance.com/press', 11);

  // Footer
  y = 280;
  pdf.setFontSize(8);
  pdf.setTextColor(128);
  pdf.text(`© ${new Date().getFullYear()} Voyance. All rights reserved.`, pageWidth / 2, y, { align: 'center' });
  pdf.text('This press kit is for media use only.', pageWidth / 2, y + 4, { align: 'center' });

  // Save the PDF
  pdf.save('Voyance-Press-Kit-2024.pdf');
}

export default generatePressKitPDF;
