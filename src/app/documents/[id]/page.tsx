'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const [document, setDocument] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ Firestore se document fetch
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
        <Link href="/documents" className="text-blue-600 hover:underline">
          Back to documents
        </Link>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="text-red-500 text-xl mb-4">Document not found</div>
        <Link href="/documents" className="text-blue-600 hover:underline">
          Back to documents
        </Link>
      </div>
    );
  }

  // ✅ Firestore me analysis object ke andar data hota hai
  const analysis = document.analysis || {};
  const risksList = analysis?.risks || [];
  const recommendations = analysis?.recommendations || [];

  const riskLevel = analysis?.riskLevel || 'UNKNOWN';

  const getRiskBadgeColor = () => {
    switch (riskLevel) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

      <div className="flex justify-between items-start mb-6">
        <h1 className="text-3xl font-bold break-words pr-4">{document.fileName}</h1>
        {document.fileType && (
          <span className="px-3 py-1 bg-gray-100 text-sm rounded-md">
            {document.fileType.toUpperCase()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side - Main Content */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Summary</h2>
            <p className="text-gray-700 whitespace-pre-line">{analysis.summary || "No summary available."}</p>
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
                {risksList.map((risk: string, i: number) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>
            ) : (
              <p className="text-green-700">No significant risks detected.</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Recommendations</h2>
            {recommendations.length > 0 ? (
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {recommendations.map((rec: string, i: number) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No recommendations provided.</p>
            )}
          </div>
        </div>

        {/* Right Side - Metadata */}
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
                : "No metadata available."}
            </dl>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-3">Activity</h2>
            <div className="space-y-3 text-sm text-gray-600">
              <div>📅 Uploaded: {new Date(document.uploadDate).toLocaleString()}</div>
              <div>🧠 Analyzed: {analysis.riskLevel ? "Yes" : "No"}</div>
              <div>💾 Firestore ID: {id}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
