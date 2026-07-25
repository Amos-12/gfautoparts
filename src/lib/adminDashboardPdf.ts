import jsPDF from 'jspdf';

interface DashboardStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  todayProfit: number;
  todaySales: number;
  avgBasket: number;
  totalProducts: number;
  totalSellers: number;
  lowStockCount: number;
  profitMargin: number;
}

interface TopProduct {
  name: string;
  revenue: number;
  sales?: number;
  percent?: number;
}

interface CategoryData {
  name: string;
  value: number;
}

interface SellerData {
  name: string;
  sales: number;
  revenue: number;
}

interface CompanySettings {
  company_name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logo_url?: string;
  usd_htg_rate?: number;
  tva_rate?: number;
  company_description?: string;
  payment_terms?: string;
}

// Helper function to format numbers with space as thousand separator
const formatNumber = (num: number, decimals = 0): string => {
  const fixed = decimals > 0 ? num.toFixed(decimals) : Math.round(num).toString();
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decPart ? `${formattedInt}.${decPart}` : formattedInt;
};

export const generateAdminDashboardPdf = async (
  stats: DashboardStats,
  topProducts: TopProduct[],
  categoryData: CategoryData[],
  topSellers: SellerData[],
  companySettings: CompanySettings,
  period: string = 'Journalier'
): Promise<void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  // ===== HEADER - INVENTORY STYLE =====
  // Logo on the left
  if (companySettings.logo_url) {
    try {
      pdf.addImage(companySettings.logo_url, 'PNG', margin, yPos - 5, 30, 30);
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }

  // Company info on the right
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text(companySettings.company_name, pageWidth - margin, yPos, { align: 'right' });
  yPos += 5;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${companySettings.address}, ${companySettings.city}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 4;
  pdf.text(`Tél: ${companySettings.phone}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 4;
  pdf.text(companySettings.email, pageWidth - margin, yPos, { align: 'right' });

  yPos = 55;

  // Title centered
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TABLEAU DE BORD ADMINISTRATEUR', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Période: ${period} | Généré le: ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // ===== STATS BOXES - INVENTORY STYLE =====
  const boxWidth = (contentWidth - 15) / 4;
  const boxHeight = 20;
  const boxY = yPos;

  const drawStatBox = (x: number, label: string, value: string, bgColor: [number, number, number]) => {
    pdf.setFillColor(...bgColor);
    pdf.roundedRect(x, boxY, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(value, x + boxWidth / 2, boxY + 10, { align: 'center' });
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, x + boxWidth / 2, boxY + 16, { align: 'center' });
  };

  drawStatBox(margin, "Revenus Aujourd'hui", `${formatNumber(stats.todayRevenue)} HTG`, [34, 197, 94]); // Green
  drawStatBox(margin + boxWidth + 5, "Ventes Aujourd'hui", stats.todaySales.toString(), [59, 130, 246]); // Blue
  drawStatBox(margin + (boxWidth + 5) * 2, 'Alertes Stock', stats.lowStockCount.toString(), [249, 115, 22]); // Orange
  drawStatBox(margin + (boxWidth + 5) * 3, 'Produits Actifs', stats.totalProducts.toString(), [100, 100, 100]); // Gray

  pdf.setTextColor(0, 0, 0);
  yPos = boxY + boxHeight + 15;

  // ===== ADDITIONAL KPIs =====
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Indicateurs Clés', margin, yPos);
  yPos += 8;

  // KPI table
  pdf.setFillColor(50, 50, 50);
  pdf.rect(margin, yPos, contentWidth, 8, 'F');
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Indicateur', margin + 5, yPos + 5.5);
  pdf.text('Valeur', margin + contentWidth - 5, yPos + 5.5, { align: 'right' });
  pdf.setTextColor(0, 0, 0);
  yPos += 10;

  const kpiData = [
    { label: "Bénéfices Aujourd'hui", value: `${formatNumber(stats.todayProfit)} HTG` },
    { label: 'Revenus Semaine', value: `${formatNumber(stats.weekRevenue)} HTG` },
    { label: 'Revenus Mois', value: `${formatNumber(stats.monthRevenue)} HTG` },
    { label: 'Panier Moyen', value: `${formatNumber(stats.avgBasket)} HTG` },
    { label: 'Marge Bénéficiaire', value: `${stats.profitMargin.toFixed(1)}%` },
    { label: 'Vendeurs Actifs', value: stats.totalSellers.toString() },
  ];

  if (companySettings.usd_htg_rate) {
    kpiData.push({ label: 'Taux USD/HTG', value: `1 USD = ${formatNumber(companySettings.usd_htg_rate, 2)} HTG` });
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  kpiData.forEach((kpi, idx) => {
    if (idx % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPos - 4, contentWidth, 6, 'F');
    }
    pdf.text(kpi.label, margin + 5, yPos);
    pdf.setFont('helvetica', 'bold');
    pdf.text(kpi.value, margin + contentWidth - 5, yPos, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    yPos += 6;
  });

  yPos += 10;

  // ===== TOP 10 PRODUCTS TABLE =====
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Top 10 Produits par Revenus', margin, yPos);
  yPos += 8;

  const totalProductRevenue = topProducts.reduce((sum, p) => sum + p.revenue, 0);

  // Table header - dark style
  pdf.setFillColor(50, 50, 50);
  pdf.rect(margin, yPos, contentWidth, 8, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('#', margin + 5, yPos + 5.5);
  pdf.text('Produit', margin + 15, yPos + 5.5);
  pdf.text('Revenus', margin + contentWidth - 35, yPos + 5.5);
  pdf.text('%', margin + contentWidth - 8, yPos + 5.5);
  pdf.setTextColor(0, 0, 0);
  yPos += 10;

  // Table rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);

  topProducts.slice(0, 10).forEach((product, index) => {
    const percent = totalProductRevenue > 0 ? ((product.revenue / totalProductRevenue) * 100).toFixed(1) : '0';
    
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPos - 4, contentWidth, 6, 'F');
    }
    
    pdf.text(`${index + 1}`, margin + 5, yPos);
    
    const productName = product.name.length > 40 ? product.name.substring(0, 40) + '...' : product.name;
    pdf.text(productName, margin + 15, yPos);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${formatNumber(product.revenue)} HTG`, margin + contentWidth - 35, yPos);
    
    pdf.setTextColor(59, 130, 246);
    pdf.text(`${percent}%`, margin + contentWidth - 8, yPos);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    
    yPos += 6;
  });

  yPos += 10;

  // ===== TOP 5 SELLERS TABLE =====
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Top 5 Vendeurs', margin, yPos);
  yPos += 8;

  const totalSellerRevenue = topSellers.reduce((sum, s) => sum + s.revenue, 0);

  // Table header
  pdf.setFillColor(50, 50, 50);
  pdf.rect(margin, yPos, contentWidth, 8, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('#', margin + 5, yPos + 5.5);
  pdf.text('Vendeur', margin + 15, yPos + 5.5);
  pdf.text('Ventes', margin + 95, yPos + 5.5);
  pdf.text('Revenus', margin + contentWidth - 35, yPos + 5.5);
  pdf.text('%', margin + contentWidth - 8, yPos + 5.5);
  pdf.setTextColor(0, 0, 0);
  yPos += 10;

  // Table rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);

  // Medal colors for top 3
  const medalColors: [number, number, number][] = [
    [234, 179, 8],   // Gold
    [156, 163, 175], // Silver
    [180, 83, 9],    // Bronze
  ];

  topSellers.slice(0, 5).forEach((seller, index) => {
    const percent = totalSellerRevenue > 0 ? ((seller.revenue / totalSellerRevenue) * 100).toFixed(1) : '0';
    
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, yPos - 4, contentWidth, 6, 'F');
    }
    
    // Rank with medal color
    if (index < 3) {
      pdf.setTextColor(medalColors[index][0], medalColors[index][1], medalColors[index][2]);
      pdf.setFont('helvetica', 'bold');
    }
    pdf.text(`${index + 1}`, margin + 5, yPos);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    
    pdf.text(seller.name, margin + 15, yPos);
    pdf.text(`${seller.sales}`, margin + 95, yPos);
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${formatNumber(seller.revenue)} HTG`, margin + contentWidth - 35, yPos);
    
    pdf.setTextColor(236, 72, 153);
    pdf.text(`${percent}%`, margin + contentWidth - 8, yPos);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    
    yPos += 6;
  });

  yPos += 10;

  // ===== CATEGORY DISTRIBUTION =====
  if (yPos > pageHeight - 60) {
    pdf.addPage();
    yPos = 20;
  }

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Répartition par Catégorie', margin, yPos);
  yPos += 8;

  const totalCategoryValue = categoryData.reduce((sum, c) => sum + c.value, 0);
  const categoryColors: [number, number, number][] = [
    [59, 130, 246], [34, 197, 94], [245, 158, 11], [239, 68, 68],
    [139, 92, 246], [6, 182, 212], [236, 72, 153], [132, 204, 22]
  ];

  categoryData.forEach((cat, index) => {
    const percent = totalCategoryValue > 0 ? ((cat.value / totalCategoryValue) * 100) : 0;
    const barWidth = (percent / 100) * (contentWidth - 80);
    const color = categoryColors[index % categoryColors.length];
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const catName = cat.name.length > 18 ? cat.name.substring(0, 18) + '...' : cat.name;
    pdf.text(catName, margin, yPos + 4);
    
    // Progress bar background
    pdf.setFillColor(241, 245, 249);
    pdf.roundedRect(margin + 50, yPos, contentWidth - 80, 6, 2, 2, 'F');
    
    // Progress bar fill
    if (barWidth > 2) {
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.roundedRect(margin + 50, yPos, barWidth, 6, 2, 2, 'F');
    }
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${cat.value} (${percent.toFixed(0)}%)`, margin + contentWidth - 25, yPos + 4);
    
    yPos += 9;
  });

  // ===== FOOTER - INVENTORY STYLE =====
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Généré par ${companySettings.company_name} - ${new Date().toLocaleDateString('fr-FR')}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Save the PDF
  const fileName = `dashboard-admin-${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
};
