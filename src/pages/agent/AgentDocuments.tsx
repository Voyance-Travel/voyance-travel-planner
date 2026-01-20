import { useState, useEffect } from 'react';
import { FileText, Plus, Search, Download, Trash2, Eye, Loader2, Filter } from 'lucide-react';
import AgentLayout from '@/components/agent/AgentLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgentAuth } from '@/hooks/useAgentAuth';
import { getDocuments } from '@/services/agencyCRM';
import type { AgencyDocument } from '@/services/agencyCRM/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import DocumentUploadModal from '@/components/agent/DocumentUploadModal';

const documentTypeLabels: Record<string, string> = {
  booking_confirmation: 'Booking Confirmation',
  invoice: 'Invoice',
  quote: 'Quote',
  itinerary: 'Itinerary',
  voucher: 'Voucher',
  passport_copy: 'Passport Copy',
  visa: 'Visa',
  travel_insurance: 'Travel Insurance',
  other: 'Other',
};

export default function AgentDocuments() {
  const { isReady, isLoading: authLoading } = useAgentAuth();
  const [documents, setDocuments] = useState<AgencyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    loadDocuments();
  }, [isReady]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const data = await getDocuments();
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast({ title: 'Failed to load documents', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (doc: AgencyDocument) => {
    try {
      // Delete from storage first
      if (doc.file_url) {
        // Extract path from URL
        const urlParts = doc.file_url.split('/agency-documents/');
        if (urlParts[1]) {
          await supabase.storage.from('agency-documents').remove([urlParts[1]]);
        }
      }
      
      // Delete from database
      const { error } = await supabase
        .from('agency_documents')
        .delete()
        .eq('id', doc.id);
      
      if (error) throw error;
      
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast({ title: 'Document deleted' });
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast({ title: 'Failed to delete document', variant: 'destructive' });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || doc.document_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (authLoading) {
    return (
      <AgentLayout breadcrumbs={[{ label: 'Dashboard', href: '/agent' }, { label: 'Documents' }]}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/agent' },
        { label: 'Documents' }
      ]}
    >
      <Head
        title="Documents | AgentOS"
        description="Manage all your client documents and files"
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold">Documents</h1>
            <p className="text-muted-foreground">
              All uploaded files across trips and clients
            </p>
          </div>
          <Button onClick={() => setUploadModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(documentTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Documents List */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">
                {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                {documents.length === 0 
                  ? 'Upload confirmations, vouchers, invoices, and other trip documents to keep everything organized.'
                  : 'Try adjusting your search or filter to find what you\'re looking for.'}
              </p>
              {documents.length === 0 && (
                <Button onClick={() => setUploadModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Your First Document
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map(doc => (
              <Card key={doc.id} className="hover:shadow-md transition-shadow group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{doc.name}</h4>
                      <Badge variant="secondary" className="mt-1">
                        {documentTypeLabels[doc.document_type] || doc.document_type}
                      </Badge>
                      {doc.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {doc.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {doc.file_size_bytes && (
                          <span>{formatFileSize(doc.file_size_bytes)}</span>
                        )}
                        <span>{format(new Date(doc.uploaded_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => window.open(doc.file_url, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex-1"
                      asChild
                    >
                      <a href={doc.file_url} download={doc.file_name || doc.name}>
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </a>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(doc)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal - No trip required for global uploads */}
      <DocumentUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        tripId={undefined as any} // Allow uploading without a trip
        onSuccess={() => {
          loadDocuments();
          setUploadModalOpen(false);
        }}
      />
    </AgentLayout>
  );
}
