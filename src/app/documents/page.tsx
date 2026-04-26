'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

interface Document {
  id: string;
  fileName: string;
  riskLevel: string;
  timestamp: any;
  fileSize: number;
  analysis?: any;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  // ✅ Compare state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [compareResult, setCompareResult] = useState<string>('');
  const [comparing, setComparing] = useState(false);

  useEffect(() => { fetchDocuments(); }, []);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'documents'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document));
      setDocuments(docs);
      setError(null);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.analysis?.summary && doc.analysis.summary.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    if (sortBy === 'date') return (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0);
    return a.fileName.localeCompare(b.fileName);
  });

  // ✅ Toggle doc selection for compare
  const toggleSelectDoc = (docId: string) => {
    setSelectedDocs(prev => {
      if (prev.includes(docId)) return prev.filter(d => d !== docId);
      if (prev.length >= 2) return prev; // max 2
      return [...prev, docId];
    });
  };

  // ✅ Run AI comparison
  const handleCompare = async () => {
    if (selectedDocs.length !== 2) return;
    setComparing(true);
    setShowCompare(true);
    setCompareResult('');

    const doc1 = documents.find(d => d.id === selectedDocs[0]);
    const doc2 = documents.find(d => d.id === selectedDocs[1]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Compare these two insurance policies and tell me:
1. Which one is BETTER for the policyholder and why?
2. Key differences in coverage
3. Key differences in risks
4. Which one has fairer terms?
5. Final recommendation — which should I choose?

Policy 1: ${doc1?.fileName}
${JSON.stringify(doc1?.analysis, null, 2)}

Policy 2: ${doc2?.fileName}
${JSON.stringify(doc2?.analysis, null, 2)}

Give a clear, structured comparison in English.`,
            },
          ],
          documentContext: null,
        }),
      });

      const data = await res.json();
      setCompareResult(data.reply || 'Could not generate comparison.');
    } catch {
      setCompareResult('Comparison failed. Please try again.');
    } finally {
      setComparing(false);
    }
  };

  const resetCompare = () => {
    setCompareMode(false);
    setSelectedDocs([]);
    setShowCompare(false);
    setCompareResult('');
  };

  const doc1 = documents.find(d => d.id === selectedDocs[0]);
  const doc2 = documents.find(d => d.id === selectedDocs[1]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Documents</h1>
        <div className="flex gap-3">
          {/* ✅ Compare Toggle Button */}
          <button
            onClick={() => compareMode ? resetCompare() : setCompareMode(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              compareMode
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-purple-600 border-purple-300 hover:bg-purple-50'
            }`}
          >
            {compareMode ? '✕ Cancel Compare' : '⚖️ Compare Policies'}
          </button>
          <Link href="/upload" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
            Upload New
          </Link>
        </div>
      </div>

      {/* ✅ Compare Banner */}
      {compareMode && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="text-sm text-purple-700">
            {selectedDocs.length === 0 && '👆 Select 2 policies to compare'}
            {selectedDocs.length === 1 && `✅ "${doc1?.fileName}" selected — select one more`}
            {selectedDocs.length === 2 && `✅ "${doc1?.fileName}" vs "${doc2?.fileName}"`}
          </div>
          {selectedDocs.length === 2 && (
            <button
              onClick={handleCompare}
              className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700"
            >
              Compare Now →
            </button>
          )}
        </div>
      )}

      {/* ✅ Compare Result Modal */}
      {showCompare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Policy Comparison</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {doc1?.fileName} vs {doc2?.fileName}
                </p>
              </div>
              <button onClick={resetCompare} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* Risk badges */}
              <div className="flex gap-4 mb-4">
                {[doc1, doc2].map((d, i) => (
                  <div key={i} className="flex-1 bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="font-medium text-gray-700 truncate">{d?.fileName}</div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      d?.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
                      d?.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>{d?.riskLevel || 'LOW'}</span>
                  </div>
                ))}
              </div>

              {comparing ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3"></div>
                  <p className="text-gray-500 text-sm">AI is analyzing both policies...</p>
                </div>
              ) : (
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {compareResult}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!comparing && compareResult && (
              <div className="p-4 border-t flex justify-end">
                <button onClick={resetCompare} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z" />
                </svg>
              </div>
              <input
                type="search"
                className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center">
            <label className="mr-2 text-sm font-medium text-gray-700">Sort by:</label>
            <select
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
            >
              <option value="date">Date (newest)</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading documents...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <div className="text-red-500 mb-2">{error}</div>
            <button className="text-blue-600 hover:underline" onClick={fetchDocuments}>Retry</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  {compareMode && <th className="px-4 py-3">Select</th>}
                  <th className="px-6 py-3">Document</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Size</th>
                  <th className="px-6 py-3">Risk Level</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedDocuments.length > 0 ? (
                  sortedDocuments.map((doc) => {
                    const isSelected = selectedDocs.includes(doc.id);
                    const isDisabled = compareMode && selectedDocs.length === 2 && !isSelected;
                    return (
                      <tr
                        key={doc.id}
                        className={`bg-white border-b transition-colors ${
                          isSelected ? 'bg-purple-50 border-purple-200' :
                          isDisabled ? 'opacity-40' : 'hover:bg-gray-50'
                        }`}
                      >
                        {compareMode && (
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={() => toggleSelectDoc(doc.id)}
                              className="w-4 h-4 accent-purple-600 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                            </svg>
                            {doc.fileName}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {doc.timestamp ? new Date(doc.timestamp.toDate()).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(2)} KB` : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            doc.riskLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                            doc.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {doc.riskLevel || 'LOW'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/documents/${doc.id}`} className="text-blue-600 hover:underline">
                            View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={compareMode ? 6 : 5} className="px-6 py-10 text-center">
                      {searchTerm ? (
                        <p>No documents match your search criteria.</p>
                      ) : (
                        <div>
                          <p className="mb-2">No documents found.</p>
                          <Link href="/upload" className="text-blue-600 hover:underline">Upload your first document →</Link>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}