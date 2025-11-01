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

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'documents'), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Document));
      
      setDocuments(docs);
      setError(null);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort documents
  const filteredDocuments = documents.filter(doc => 
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.analysis?.summary && doc.analysis.summary.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    if (sortBy === 'date') {
      return (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0);
    } else {
      return a.fileName.localeCompare(b.fileName);
    }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Documents</h1>
        <Link 
          href="/upload"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Upload New
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
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
            <button 
              className="text-blue-600 hover:underline"
              onClick={() => fetchDocuments()}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">Document</th>
                  <th scope="col" className="px-6 py-3">Date</th>
                  <th scope="col" className="px-6 py-3">Size</th>
                  <th scope="col" className="px-6 py-3">Risk Level</th>
                  <th scope="col" className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedDocuments.length > 0 ? (
                  sortedDocuments.map((doc) => (
                    <tr key={doc.id} className="bg-white border-b hover:bg-gray-50">
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center">
                      {searchTerm ? (
                        <p>No documents match your search criteria.</p>
                      ) : (
                        <div>
                          <p className="mb-2">No documents found.</p>
                          <Link href="/upload" className="text-blue-600 hover:underline">
                            Upload your first document →
                          </Link>
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
