import OpenAI from 'openai';

// Initialize OpenAI client for NVIDIA Vision API
const visionClient = new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.NVIDIA_API_KEY,
});

// Result type for receipt detection
export interface ReceiptDetectionResult {
    isReceipt: boolean;
    confidence: number;
    details?: string;
    extractedAmount?: string;
    extractedDate?: string;
}

/**
 * Fetches an image from a URL and converts it to base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error('Failed to fetch image:', response.status, response.statusText);
            return null;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        // Determine mime type
        let mimeType = 'image/jpeg';
        if (contentType.includes('png')) {
            mimeType = 'image/png';
        } else if (contentType.includes('gif')) {
            mimeType = 'image/gif';
        } else if (contentType.includes('webp')) {
            mimeType = 'image/webp';
        }

        return { base64, mimeType };
    } catch (error) {
        console.error('Error fetching image for base64 conversion:', error);
        return null;
    }
}

/**
 * Analyzes an image URL to determine if it contains a receipt or payment proof
 */
export async function analyzeImageForReceipt(imageUrl: string): Promise<ReceiptDetectionResult> {
    console.log('Analyzing image for receipt:', imageUrl.substring(0, 100) + '...');

    try {
        // Fetch and convert image to base64
        const imageData = await fetchImageAsBase64(imageUrl);
        if (!imageData) {
            console.error('Could not fetch image for analysis');
            return { isReceipt: false, confidence: 0, details: 'Failed to fetch image' };
        }

        const { base64, mimeType } = imageData;

        // Use NVIDIA's vision model to analyze the image
        const completion = await visionClient.chat.completions.create({
            model: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: { url: `data:${mimeType};base64,${base64}` }
                        },
                        {
                            type: "text",
                            text: `Analyze this image and determine if it is a receipt, payment proof, transaction confirmation, or proof of payment.

Look for indicators such as:
- Transaction details (amount, date, reference number)
- Store/merchant names
- Payment confirmation text
- QR codes related to payments (GCash, Maya, bank transfers)
- Screenshot of banking app showing successful transfer
- Official receipt layout

Respond ONLY with a JSON object in this exact format:
{
    "isReceipt": true or false,
    "confidence": 0.0 to 1.0,
    "details": "Brief description of what you see",
    "extractedAmount": "Amount if visible, or null",
    "extractedDate": "Date if visible, or null"
}

Be strict - only mark isReceipt as true if this clearly appears to be proof of payment.`
                        }
                    ]
                }
            ],
            temperature: 0.2,
            top_p: 0.7,
            max_tokens: 500,
            stream: false,
        });

        const responseText = completion.choices[0]?.message?.content || '';
        console.log('Vision AI response:', responseText);

        // Parse the JSON response
        try {
            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return {
                    isReceipt: Boolean(result.isReceipt),
                    confidence: Number(result.confidence) || 0,
                    details: result.details || undefined,
                    extractedAmount: result.extractedAmount || undefined,
                    extractedDate: result.extractedDate || undefined,
                };
            }
        } catch (parseError) {
            console.error('Error parsing vision AI response:', parseError);
        }

        // Fallback: try to detect receipt keywords in response
        const lowerResponse = responseText.toLowerCase();
        const isLikelyReceipt = lowerResponse.includes('receipt') ||
            lowerResponse.includes('payment') ||
            lowerResponse.includes('transaction') ||
            lowerResponse.includes('transfer');

        return {
            isReceipt: isLikelyReceipt,
            confidence: isLikelyReceipt ? 0.5 : 0.2,
            details: 'Could not parse structured response',
        };

    } catch (error) {
        console.error('Error in receipt detection:', error);
        return {
            isReceipt: false,
            confidence: 0,
            details: 'Error during analysis',
        };
    }
}

/**
 * High-confidence receipt detection threshold
 */
export const RECEIPT_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Checks if the detection result indicates a confirmed receipt
 */
export function isConfirmedReceipt(result: ReceiptDetectionResult): boolean {
    return result.isReceipt && result.confidence >= RECEIPT_CONFIDENCE_THRESHOLD;
}
