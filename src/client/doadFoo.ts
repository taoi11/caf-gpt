interface ParsedResponse {
    answer: string;
    citations: string[];
}

export function parseDOADResponse(content: string): ParsedResponse {
    // Default response
    const result: ParsedResponse = {
        answer: content,  // Fallback to full content
        citations: []
    };

    try {
        // Extract answer from XML tags if present
        if (content.includes('<answer>')) {
            const start = content.indexOf('<answer>') + 8;
            const end = content.indexOf('</answer>');
            if (end > start) {
                result.answer = content.substring(start, end).trim();
            }
        }

        // Extract citations from content
        const citations: string[] = [];
        const citationPattern = /DAOD (\d{4}-\d):/g;
        let match;
        
        while ((match = citationPattern.exec(content)) !== null) {
            citations.push(match[1]);
        }
        
        result.citations = [...new Set(citations)]; // Remove duplicates

        return result;
    } catch (error) {
        console.error('Error parsing response:', error);
        return result;  // Return default if parsing fails
    }
} 