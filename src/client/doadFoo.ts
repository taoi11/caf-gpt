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
        // Simple tag extraction
        if (content.includes('<answer>')) {
            const start = content.indexOf('<answer>') + 8;
            const end = content.indexOf('</answer>');
            if (end > start) {
                result.answer = content.substring(start, end).trim();
            }
        }

        if (content.includes('<citations>')) {
            const start = content.indexOf('<citations>') + 11;
            const end = content.indexOf('</citations>');
            if (end > start) {
                result.citations = content
                    .substring(start, end)
                    .split(':')[1]  // Split on colon to get just the sections
                    ?.split(',')
                    .map(c => c.trim())
                    .filter(Boolean) || [];
            }
        }

        return result;
    } catch (error) {
        console.error('Error parsing response:', error);
        return result;  // Return default if parsing fails
    }
} 