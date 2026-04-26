'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ChatBot from '@/components/Chatbot';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const [document, setDocument] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        if (!id) return;
        setIsLoading(true);
        const docRef = doc(db, 'documents', id as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setDocument(snap.data());
        } else {
          setError('Document not found.');
        }
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Failed to load document. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDocument();
  }, [id]);

  // ✅ PDF Export using jsPDF (browser-side, no server needed)
  const handleExportPDF = async () => {
    if (!document) return;
    setExportingPdf(true);

    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const analysis = document.analysis || {};
      const riskLevel = analysis.riskLevel || 'UNKNOWN';
      const pageWidth = 210;
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;

      const addText = (text: string, fontSize: number, bold = false, color = [30, 30, 30] as [number, number, number]) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(text, contentWidth);
        if (y + lines.length * (fontSize * 0.4) > 280) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(lines, margin, y);
        y += lines.length * (fontSize * 0.4) + 3;
      };

      const addDivider = () => {
        pdf.setDrawColor(220, 220, 220);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 5;
      };

      // ── Header ──
      pdf.setFillColor(30, 41, 59);
      pdf.rect(0, 0, 210, 28, 'F');
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('DeepInshAura', margin, 13);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Insurance Policy Analysis Report', margin, 21);
      pdf.setFontSize(9);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 21, { align: 'right' });
      y = 36;

      // ── File Name ──
      addText(document.fileName, 16, true);
      y += 2;

      // ── Risk Badge ──
      const riskColor: Record<string, [number, number, number]> =
        { HIGH: [220, 38, 38], MEDIUM: [217, 119, 6], LOW: [22, 163, 74] };
      const rc = riskColor[riskLevel] || [100, 100, 100];
      pdf.setFillColor(...rc);
      pdf.roundedRect(margin, y, 28, 7, 2, 2, 'F');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text(riskLevel, margin + 14, y + 5, { align: 'center' });
      y += 12;

      addDivider();

      // ── Summary ──
      addText('Summary', 12, true, [30, 41, 59]);
      y += 1;
      addText(analysis.summary || 'No summary available.', 9, false, [60, 60, 60]);
      y += 4;
      addDivider();

      // ── Risks ──
      addText('Identified Risks', 12, true, [30, 41, 59]);
      y += 1;
      const risks: string[] = analysis.risks || [];
      if (risks.length > 0) {
        risks.forEach((risk: string, i: number) => {
          addText(`${i + 1}. ${risk}`, 8.5, false, [185, 28, 28]);
          y += 1;
        });
      } else {
        addText('No significant risks detected.', 9, false, [60, 60, 60]);
      }
      y += 3;
      addDivider();

      // ── Recommendations ──
      addText('Recommendations', 12, true, [30, 41, 59]);
      y += 1;
      const recs: string[] = analysis.recommendations || [];
      if (recs.length > 0) {
        recs.forEach((rec: string, i: number) => {
          addText(`${i + 1}. ${rec}`, 8.5, false, [30, 30, 30]);
          y += 1;
        });
      } else {
        addText('No recommendations provided.', 9, false, [60, 60, 60]);
      }
      y += 3;
      addDivider();

      // ── Metadata ──
      if (analysis.metadata) {
        addText('Metadata', 12, true, [30, 41, 59]);
        y += 1;
        Object.entries(analysis.metadata).forEach(([key, value]) => {
          addText(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${Array.isArray(value) ? value.join(', ') : value}`, 8.5, false, [60, 60, 60]);
          y += 0.5;
        });
        y += 3;
        addDivider();
      }

      // ── Activity ──
      addText('Activity', 12, true, [30, 41, 59]);
      y += 1;
      addText(`Uploaded: ${new Date(document.uploadDate).toLocaleString()}`, 8.5, false, [60, 60, 60]);
      addText(`Analyzed: ${analysis.riskLevel ? 'Yes' : 'No'}`, 8.5, false, [60, 60, 60]);
      addText(`Document ID: ${id}`, 8.5, false, [60, 60, 60]);

      // ── Footer on last page ──
      const totalPages = (pdf as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(150, 150, 150);
        pdf.text(`DeepInshAura — Confidential Report  |  Page ${p} of ${totalPages}`, pageWidth / 2, 292, { align: 'center' });
      }

      pdf.save(`${document.fileName.replace('.pdf', '')}_analysis.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('PDF export failed. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="text-red-500 text-xl mb-4">{error}</div>
        <Link href="/documents" className="text-blue-600 hover:underline">Back to documents</Link>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="text-red-500 text-xl mb-4">Document not found</div>
        <Link href="/documents" className="text-blue-600 hover:underline">Back to documents</Link>
      </div>
    );
  }

  const analysis = document.analysis || {};
  const risksList = analysis?.risks || [];
  const recommendations = analysis?.recommendations || [];
  const riskLevel = analysis?.riskLevel || 'UNKNOWN';

  const getRiskBadgeColor = () => {
    switch (riskLevel) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/documents" className="text-blue-600 hover:underline flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to documents
        </Link>
      </div>

      {/* ── Title + Export Button ── */}
      <div className="flex justify-between items-start mb-6 gap-4">
        <h1 className="text-3xl font-bold break-words pr-4">{document.fileName}</h1>
        <div className="flex items-center gap-3 flex-shrink-0">
          {document.fileType && (
            <span className="px-3 py-1 bg-gray-100 text-sm rounded-md">
              {document.fileType.toUpperCase()}
            </span>
          )}
          {/* ✅ PDF Export Button */}
          <button
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
          >
            {exportingPdf ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Download Report
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Summary</h2>
            <p className="text-gray-700 whitespace-pre-line">{analysis.summary || 'No summary available.'}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">Risk Level</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskBadgeColor()}`}>
                {riskLevel}
              </span>
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">Identified Risks</h3>
            {risksList.length > 0 ? (
              <ul className="list-disc list-inside text-red-700 space-y-1">
                {risksList.map((risk: string, i: number) => <li key={i}>{risk}</li>)}
              </ul>
            ) : (
              <p className="text-green-700">No significant risks detected.</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Recommendations</h2>
            {recommendations.length > 0 ? (
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {recommendations.map((rec: string, i: number) => <li key={i}>{rec}</li>)}
              </ul>
            ) : (
              <p className="text-gray-500">No recommendations provided.</p>
            )}
          </div>
        </div>

        {/* Right Side */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Metadata</h2>
            <dl className="space-y-2">
              {analysis.metadata
                ? Object.entries(analysis.metadata).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-3 gap-2">
                      <dt className="text-sm font-medium text-gray-500 truncate">{key}</dt>
                      <dd className="col-span-2 text-sm text-gray-900">
                        {Array.isArray(value) ? value.join(', ') : value?.toString()}
                      </dd>
                    </div>
                  ))
                : 'No metadata available.'}
            </dl>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Activity</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div>📅 Uploaded: {new Date(document.uploadDate).toLocaleString()}</div>
              <div>🧠 Analyzed: {analysis.riskLevel ? 'Yes' : 'No'}</div>
              <div>💾 Firestore ID: {id}</div>
            </div>
          </div>
        </div>
      </div>

      <ChatBot documentContext={analysis} documentName={document.fileName} />
    </div>
  );
}