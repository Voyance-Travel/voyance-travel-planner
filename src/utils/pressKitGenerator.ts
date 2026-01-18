import jsPDF from 'jspdf';

/**
 * Voyance Press Kit Generator
 * Generates a downloadable PDF press kit with company information
 */

// Company facts and information
export const companyInfo = {
  name: 'Voyance',
  tagline: 'AI-Powered Travel Planning',
  founded: '2024',
  headquarters: 'San Francisco, CA',
  website: 'https://voyance.travel',
  mission: 'To revolutionize travel planning by combining artificial intelligence with deep personalization, helping every traveler discover experiences that resonate with who they are.',
  vision: 'A world where every journey is perfectly tailored to the individual, making travel more accessible, meaningful, and memorable for everyone.',
};

export const keyStats = [
  { label: 'Destinations', value: '10,000+' },
  { label: 'Travel DNA Profiles Created', value: '50,000+' },
  { label: 'Itineraries Generated', value: '100,000+' },
  { label: 'Countries Covered', value: '190+' },
  { label: 'Average User Rating', value: '4.8/5' },
  { label: 'Time Saved Per Trip', value: '15+ hours' },
];

export const leadership = [
  {
    name: 'Alex Chen',
    title: 'Co-Founder & CEO',
    bio: 'Former product lead at Airbnb, Alex has spent over a decade building travel technology products that delight millions of users.',
  },
  {
    name: 'Sarah Martinez',
    title: 'Co-Founder & CTO',
    bio: 'Previously a senior engineer at Google, Sarah leads our AI and engineering teams in building the future of personalized travel.',
  },
  {
    name: 'David Kim',
    title: 'VP of Product',
    bio: 'With experience at Expedia and Booking.com, David brings deep expertise in travel product development.',
  },
];

export const pressHighlights = [
  'Named "Best Travel Startup of 2024" by TechCrunch',
  'Featured in Forbes "30 Under 30" Travel & Hospitality',
  'Winner of the Phocuswright Innovation Award',
  'Backed by leading investors including Sequoia and a]16z',
];

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
  pdf.text('Press Kit 2024', pageWidth / 2, 42, { align: 'center' });
  
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

  // Leadership
  addSection('Leadership Team');
  leadership.forEach(person => {
    addText(`${person.name} - ${person.title}`, 11, 'bold');
    addText(person.bio, 10);
    y += 2;
  });

  // New page for highlights and brand
  pdf.addPage();
  y = margin;

  // Press Highlights
  addSection('Press Highlights');
  pressHighlights.forEach(highlight => {
    addText(`• ${highlight}`, 11);
  });

  addDivider();

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
  addText('Email: press@voyance.travel', 11, 'bold');
  addText('Website: voyance.travel/press', 11);

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
