import { createServiceClient } from '../_shared/supabase-client.ts';
import { corsHeaders, handleCorsPreflightRequest } from '../_shared/cors-headers.ts';
import { verifyAuth } from '../_shared/auth-helpers.ts';
import { errorResponse } from '../_shared/response-helpers.ts';

// Assemble final CSV from batch files using PARALLEL downloads
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const { authenticated, error: authError } = await verifyAuth(authHeader);

    if (!authenticated) {
      return errorResponse(authError || 'Unauthorized', 401);
    }

    const { jobId } = await req.json();
    
    if (!jobId) {
      return errorResponse('Missing jobId', 400);
    }

    const supabase = createServiceClient();

    console.log(`Assembling job: ${jobId}`);

    // Paginate through ALL files in storage
    const allFiles: { name: string }[] = [];
    let offset = 0;
    const pageSize = 100;
    
    while (true) {
      const { data: files, error: listError } = await supabase.storage
        .from('exports')
        .list(`temp/${jobId}`, { 
          sortBy: { column: 'name', order: 'asc' },
          limit: pageSize,
          offset: offset
        });

      if (listError) {
        console.error('List error:', listError);
        return errorResponse('Failed to list files', 500, listError);
      }

      if (!files || files.length === 0) break;
      
      allFiles.push(...files);
      
      if (files.length < pageSize) break;
      offset += pageSize;
    }

    if (allFiles.length === 0) {
      console.error('No files found');
      return errorResponse('No batch files found', 404);
    }

    console.log(`Found ${allFiles.length} files to assemble - using PARALLEL downloads`);

    // Download all files in PARALLEL (much faster than sequential)
    const PARALLEL_BATCH_SIZE = 20; // Download 20 files at a time
    const fileContents: { name: string; content: string }[] = [];
    
    for (let i = 0; i < allFiles.length; i += PARALLEL_BATCH_SIZE) {
      const batch = allFiles.slice(i, i + PARALLEL_BATCH_SIZE);
      
      const results = await Promise.all(
        batch.map(async (file) => {
          const { data, error } = await supabase.storage
            .from('exports')
            .download(`temp/${jobId}/${file.name}`);

          if (error) {
            console.error(`Download error ${file.name}:`, error);
            return { name: file.name, content: '' };
          }

          return { name: file.name, content: await data.text() };
        })
      );
      
      fileContents.push(...results);
      console.log(`Downloaded ${Math.min(i + PARALLEL_BATCH_SIZE, allFiles.length)}/${allFiles.length} files`);
    }

    // Sort by filename to ensure correct order (00000.csv, 00001.csv, etc.)
    fileContents.sort((a, b) => a.name.localeCompare(b.name));

    // Concatenate all content
    let csv = '';
    let totalRecords = 0;

    for (const file of fileContents) {
      if (!file.content) continue;
      csv += file.content;
      
      const lines = file.content.split('\n').filter(l => l.trim()).length;
      totalRecords += file.name === '00000.csv' ? lines - 1 : lines;
    }

    console.log(`Total records: ${totalRecords}, CSV size: ${(csv.length / 1024 / 1024).toFixed(2)} MB`);

    // Upload final file
    const fileName = `master-${jobId.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`;
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, csv, { contentType: 'text/csv', upsert: true });

    if (uploadError) {
      console.error('Final upload error:', uploadError);
      return errorResponse('Upload failed', 500, uploadError);
    }

    // Get signed URL (valid for 1 hour)
    const { data: urlData } = await supabase.storage
      .from('exports')
      .createSignedUrl(fileName, 3600);

    // Update job
    await supabase
      .from('export_jobs')
      .update({
        status: 'completed',
        file_url: urlData?.signedUrl || fileName,
        processed_records: totalRecords,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Cleanup temp files in background (parallel deletion)
    console.log(`Cleaning up ${allFiles.length} temp files...`);
    const deletePromises = allFiles.map(file => 
      supabase.storage.from('exports').remove([`temp/${jobId}/${file.name}`]).catch(() => {})
    );
    await Promise.all(deletePromises);

    console.log(`Complete: ${fileName}, ${totalRecords} records`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        fileUrl: urlData?.signedUrl,
        fileName,
        totalRecords
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Assembly error:', error);
    return errorResponse('Failed', 500, error instanceof Error ? error.message : 'Unknown');
  }
});
