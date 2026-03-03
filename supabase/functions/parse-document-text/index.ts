// Extract text from uploaded documents (PDF, text files)
// For use with booking import

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    
    let text = '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      
      if (!file) {
        return new Response(
          JSON.stringify({ error: 'No file provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const fileType = file.type;
      const fileName = file.name.toLowerCase();

      // Handle text-based files directly
      if (fileType.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.html') || fileName.endsWith('.eml')) {
        text = await file.text();
      } 
      // For PDFs, try basic text extraction
      else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        // Read PDF as array buffer
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        
        // Simple PDF text extraction - look for text streams
        // This is a basic implementation that works for text-based PDFs
        const pdfString = new TextDecoder('latin1').decode(bytes);
        
        // Extract text between stream markers and decode
        const textParts: string[] = [];
        const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
        let match;
        
        while ((match = streamRegex.exec(pdfString)) !== null) {
          const streamContent = match[1];
          // Try to extract readable text from the stream
          const readableChars = streamContent.replace(/[^\x20-\x7E\n\r]/g, ' ');
          if (readableChars.trim().length > 10) {
            textParts.push(readableChars.trim());
          }
        }
        
        // Also try to find text in parentheses (PDF text objects)
        const textObjRegex = /\(([^)]+)\)/g;
        while ((match = textObjRegex.exec(pdfString)) !== null) {
          const textContent = match[1];
          if (textContent.length > 2 && /[a-zA-Z]/.test(textContent)) {
            textParts.push(textContent);
          }
        }
        
        text = textParts.join('\n').replace(/\s+/g, ' ').trim();
        
        if (!text || text.length < 20) {
          // If extraction failed, inform the user
          return new Response(
            JSON.stringify({ 
              error: 'Could not extract text from this PDF. It may be image-based or encrypted. Try copying the text manually.',
              partial_text: text 
            }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: `Unsupported file type: ${fileType || fileName}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Handle JSON body with base64 content
      const body = await req.json();
      if (body.text) {
        text = body.text;
      } else if (body.base64) {
        const decoded = atob(body.base64);
        text = decoded;
      } else {
        return new Response(
          JSON.stringify({ error: 'No text or base64 content provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Clean up extracted text
    text = text
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E\n\r]/g, ' ')
      .trim();

    console.log(`Extracted ${text.length} characters of text`);

    return new Response(
      JSON.stringify({ 
        success: true,
        text,
        length: text.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing document:', error);
    return new Response(
      JSON.stringify({ success: false, error: "Document processing failed", code: "PARSE_ERROR" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
