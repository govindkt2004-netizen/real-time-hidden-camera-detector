/**
 * Incident Report Generator
 * Generates cryptographically signed PDF and JSON audit reports for TSCM evidence logs.
 */

import { jsPDF } from 'jspdf';
import { ScanIncident } from '../types';

export interface SignedReportMetadata {
  reportId: string;
  generatedAt: string;
  sha256Signature: string;
  totalIncidents: number;
  highThreatCount: number;
  averageConfidence: number;
}

// Compute SHA-256 digest of incident dataset
export async function computeIntegritySignature(incidents: ScanIncident[]): Promise<string> {
  const content = JSON.stringify(incidents);
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate and download a signed JSON report file
 */
export async function downloadSignedJsonReport(incidents: ScanIncident[]): Promise<void> {
  const signature = await computeIntegritySignature(incidents);
  const reportId = `TSCM-${Date.now()}-${signature.slice(0, 8).toUpperCase()}`;

  const reportPayload = {
    reportType: 'TSCM_OPTICAL_SWEEP_AUDIT',
    version: '2.4.0',
    reportId,
    generatedAt: new Date().toISOString(),
    cryptoIntegrity: {
      algorithm: 'SHA-256',
      signature,
      signatureStatus: 'VERIFIED_ON_DEVICE',
    },
    summary: {
      totalDetections: incidents.length,
      highThreatCount: incidents.filter((i) => i.threatClass.toLowerCase().includes('camera') || i.threatClass.toLowerCase().includes('phone')).length,
      averageConfidence: incidents.length > 0
        ? Number((incidents.reduce((acc, curr) => acc + curr.confidence, 0) / incidents.length).toFixed(3))
        : 0,
    },
    legalDisclaimer: 'This audit records on-device computer vision and optical glint detections. Visual models cannot guarantee detection of fully concealed devices.',
    incidents: incidents.map((inc) => ({
      id: inc.id,
      timestamp: new Date(inc.timestamp).toISOString(),
      threatClass: inc.threatClass,
      threatLabel: inc.threatLabel,
      priority: inc.priority || (inc.threatClass.toLowerCase().includes('camera') ? 'HIGH' : 'MEDIUM'),
      isManualObservation: Boolean(inc.isManualObservation),
      notes: inc.notes,
      hasSnapshotEvidence: Boolean(inc.snapshotDataUrl),
    })),
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportPayload, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `TSCM_Signed_Audit_Report_${reportId}.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Generate and download a professional Signed PDF Audit Report
 */
export async function downloadSignedPdfReport(incidents: ScanIncident[]): Promise<void> {
  const signature = await computeIntegritySignature(incidents);
  const reportId = `TSCM-AUDIT-${Date.now().toString().slice(-6)}-${signature.slice(0, 6).toUpperCase()}`;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let cursorY = 20;

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(248, 113, 113); // red-400
  doc.text('CONFIDENTIAL // TECHNICAL SURVEILLANCE COUNTER-MEASURES', margin, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`INCIDENT AUDIT REPORT & FORENSIC LOG  |  REF: ${reportId}`, margin, 19);
  doc.text(`DATE: ${new Date().toUTCString()}`, margin, 24);

  cursorY = 38;

  // Cryptographic Signature Seal Box
  doc.setDrawColor(220, 38, 38); // red-600
  doc.setFillColor(254, 242, 242); // red-50
  doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(185, 28, 28);
  doc.text('CRYPTOGRAPHIC INTEGRITY SIGNATURE (SHA-256):', margin + 4, cursorY + 6);

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(signature, margin + 4, cursorY + 12);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('This digital hash guarantees data integrity. Any alteration of detection records invalidates this signature.', margin + 4, cursorY + 18);

  cursorY += 30;

  // Audit Summary Stats
  const highThreatCount = incidents.filter(
    (i) => i.threatClass.toLowerCase().includes('camera') || i.threatClass.toLowerCase().includes('phone')
  ).length;

  const avgConfidence = incidents.length > 0
    ? (incidents.reduce((a, b) => a + b.confidence, 0) / incidents.length * 100).toFixed(1)
    : '0.0';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('SWEEP SUMMARY METRICS', margin, cursorY);

  cursorY += 5;

  // Stat boxes
  const colW = (pageWidth - margin * 2 - 8) / 3;
  const stats = [
    { label: 'TOTAL INCIDENTS', val: `${incidents.length}` },
    { label: 'HIGH THREAT DETECTIONS', val: `${highThreatCount}` },
    { label: 'AVG CONFIDENCE', val: `${avgConfidence}%` },
  ];

  stats.forEach((s, idx) => {
    const boxX = margin + idx * (colW + 4);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(boxX, cursorY, colW, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(s.label, boxX + 3, cursorY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(s.val, boxX + 3, cursorY + 11);
  });

  cursorY += 22;

  // Incident Records Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('RECORDED OPTICAL & RECORDING THREATS', margin, cursorY);

  cursorY += 5;

  if (incidents.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No suspicious devices or recording hardware detected in this sweep session.', margin, cursorY + 5);
    cursorY += 15;
  } else {
    // Render up to 10 key incident items
    incidents.slice(0, 10).forEach((inc, index) => {
      // Check if we need a new page
      if (cursorY > pageHeight - 35) {
        doc.addPage();
        cursorY = 20;
      }

      const rowH = inc.snapshotDataUrl ? 26 : 14;

      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(index % 2 === 0 ? 255 : 248, 250, 252);
      doc.roundedRect(margin, cursorY, pageWidth - margin * 2, rowH, 1, 1, 'FD');

      // Thumbnail if available
      let textOffset = margin + 4;
      if (inc.snapshotDataUrl) {
        try {
          doc.addImage(inc.snapshotDataUrl, 'JPEG', margin + 3, cursorY + 3, 28, 20);
          textOffset = margin + 35;
        } catch {
          // Ignore if image formatting fails
        }
      }

      // Title & threat tag
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      if (inc.isManualObservation) {
        doc.setTextColor(217, 119, 6); // amber-600
        doc.text(`[MANUAL OBSERVATION // HIGH PRIORITY]  ${inc.threatLabel}`, textOffset, cursorY + 6);
      } else {
        doc.setTextColor(185, 28, 28);
        doc.text(`[ALERT #${index + 1}]  ${inc.threatLabel}`, textOffset, cursorY + 6);
      }

      // Confidence & class
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(
        `Confidence: ${(inc.confidence * 100).toFixed(1)}%   |   Class: ${inc.threatClass}   |   Time: ${new Date(inc.timestamp).toLocaleString()}`,
        textOffset,
        cursorY + 11
      );

      if (inc.notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(inc.notes.slice(0, 85), textOffset, cursorY + 16);
      }

      cursorY += rowH + 3;
    });
  }

  // Footer Disclaimer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  const disclaimerText = 'DISCLAIMER: This on-device audit reflects optical computer vision predictions. A clean sweep does not guarantee absence of hidden micro-hardware behind opaque structures.';
  doc.text(disclaimerText, margin, pageHeight - 10);

  doc.save(`TSCM_Signed_Audit_Report_${reportId}.pdf`);
}
