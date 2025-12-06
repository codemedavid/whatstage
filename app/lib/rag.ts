import { supabase } from './supabase';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const EMBEDDING_MODEL = 'nvidia/nv-embedqa-e5-v5';

async function getEmbedding(text: string, inputType: 'query' | 'passage'): Promise<number[]> {
    const response = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: [text],
            input_type: inputType,
            encoding_format: 'float',
            truncate: 'END',
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Embedding error:', errorText);
        throw new Error(`Embedding API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}

export async function addDocument(content: string, metadata: any = {}) {
    try {
        // 1. Chunk the text
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunks = await splitter.createDocuments([content]);

        // 2. Generate embeddings and store in Supabase
        for (const chunk of chunks) {
            const embedding = await getEmbedding(chunk.pageContent, 'passage');

            const { error } = await supabase.from('documents').insert({
                content: chunk.pageContent,
                metadata: { ...metadata, ...chunk.metadata },
                embedding: embedding,
            });

            if (error) {
                console.error('Error inserting chunk:', error);
                throw error;
            }
        }

        return true;
    } catch (error) {
        console.error('Error adding document:', error);
        return false;
    }
}

export async function searchDocuments(query: string, limit: number = 3) {
    try {
        // 1. Generate embedding for query
        const queryEmbedding = await getEmbedding(query, 'query');
        console.log('Query embedding length:', queryEmbedding.length);

        // 2. Search Supabase via RPC
        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5, // Higher threshold for more relevant matches
            match_count: limit,
        });

        if (error) {
            console.error('Error searching documents:', error);
            throw error;
        }

        console.log('RAG search results:', documents?.length, documents);

        if (!documents || documents.length === 0) {
            return '';
        }

        return documents.map((doc: any) => doc.content).join('\n\n');
    } catch (error) {
        console.error('Error in RAG search:', error);
        return '';
    }
}
