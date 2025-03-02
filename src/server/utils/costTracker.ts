/**
 * Cost tracking system with database persistence.
 * Simplified implementation with basic error handling.
 */
import { logger } from './logger';
import { dbClient } from './dbClient';
import { appState } from './bootup';
import type { CostData, LLMResponse } from '../types';

const MONTHLY_SERVER_COST = 15.70; // Base monthly server cost in USD
const OPENROUTER_API_KEY = process.env.LLM_API_KEY || '';

class CostTracker {
    private data: CostData = {
        apiCosts: 0,
        serverCosts: MONTHLY_SERVER_COST,
        lastReset: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString()
    };
    
    constructor() {
        this.initializeStorage().catch(error => {
            logger.error('Failed to initialize cost tracker:', error);
        });
    }

    private async initializeStorage(): Promise<void> {
        try {
            await this.loadData();
            await this.checkMonthlyReset();
        } catch (error) {
            logger.error('Failed to initialize storage', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Continue with default values
        }
    }

    private async checkMonthlyReset(): Promise<void> {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Check if it's the first day of the month
        if (now.getDate() === 1) {
            const lastResetDate = new Date(this.data.lastReset);
            
            // Only reset if we haven't already reset this month
            if (lastResetDate.getMonth() !== now.getMonth() || 
                lastResetDate.getFullYear() !== now.getFullYear()) {
                logger.info('Performing monthly cost reset');
                this.data.apiCosts = 0;
                this.data.serverCosts = MONTHLY_SERVER_COST;
                this.data.lastReset = today;
                await this.saveData();
            }
        }
    }

    private async loadData(): Promise<void> {
        try {
            // Only attempt to load data if database is connected
            if (!appState.isDbConnected && !process.env.DATABASE_URL) {
                logger.warn('Database not connected, using default cost values');
                return;
            }
            
            const result = await dbClient.query(
                'SELECT api_costs, server_costs, last_reset::text, last_updated::text FROM costs WHERE id = 1'
            );
            
            if (result.rows.length > 0) {
                const row = result.rows[0];
                this.data = {
                    apiCosts: parseFloat(row.api_costs),
                    serverCosts: parseFloat(row.server_costs),
                    lastReset: row.last_reset,
                    lastUpdated: row.last_updated
                };
                logger.info('Cost data loaded successfully from database');
            } else {
                logger.info('No existing cost data found in database, using defaults');
                await this.saveData();
            }
        } catch (error) {
            logger.error('Error loading cost data from database', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Continue with default values
        }
    }

    private async saveData(): Promise<void> {
        try {
            // Only attempt to save data if database is connected
            if (!appState.isDbConnected && !process.env.DATABASE_URL) {
                logger.warn('Database not connected, skipping cost data save');
                return;
            }
            
            await dbClient.query(
                'UPDATE costs SET api_costs = $1, server_costs = $2, last_reset = $3, last_updated = $4 WHERE id = 1',
                [this.data.apiCosts, this.data.serverCosts, this.data.lastReset, this.data.lastUpdated]
            );
            logger.debug('Cost data saved successfully to database');
        } catch (error) {
            logger.error('Failed to save cost data to database', {
                error: error instanceof Error ? error.message : String(error)
            });
            // Continue without saving - will try again next time
        }
    }

    private async fetchGenerationCost(genId: string): Promise<number> {
        try {
            // Add required OpenRouter headers
            const response = await fetch(`https://openrouter.ai/api/v1/generation?id=${genId}`, {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://caf-gpt.com',
                    'X-Title': 'CAF-GPT'
                }
            });

            if (!response.ok) {
                // Enhanced error logging
                const errorBody = await response.text();
                logger.error('Cost API Error', {
                    status: response.status,
                    statusText: response.statusText,
                    genId,
                    error: errorBody
                });
                throw new Error(`Failed to fetch generation cost: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.data.total_cost || 0;
        } catch (error) {
            logger.error('Error fetching generation cost', {
                error: error instanceof Error ? error.message : String(error),
                genId
            });
            return 0;
        }
    }

    /**
     * Tracks API costs using OpenRouter's generation endpoint
     * @param genId - OpenRouter generation ID from API response
     */
    public async trackRequest(genId: string): Promise<void> {
        // Wait 1 second before fetching cost to ensure generation is complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        const cost = await this.fetchGenerationCost(genId);
        if (cost > 0) {
            this.data.apiCosts += cost;
            this.data.lastUpdated = new Date().toISOString();
            await this.saveData();
            
            logger.debug('Cost tracked:', {
                generationId: genId,
                cost: cost.toFixed(6),
                totalApiCost: this.data.apiCosts.toFixed(6)
            });
        }
    }

    /**
     * Estimates costs based on token usage from LLM responses
     * @param usage - Token usage data from LLM response
     */
    public async trackUsage(usage: LLMResponse['usage']): Promise<void> {
        if (!usage) return;

        // Estimate cost based on token usage (simplified calculation)
        const cost = (usage.prompt_tokens + usage.completion_tokens) * 0.000001; // $0.001 per 1K tokens
        
        this.data.apiCosts += cost;
        this.data.lastUpdated = new Date().toISOString();
        await this.saveData();
        
        logger.debug('Usage tracked:', {
            tokens: usage.total_tokens,
            cost: cost.toFixed(6),
            totalApiCost: this.data.apiCosts.toFixed(6)
        });
    }

    /**
     * Returns current cost data
     * Always returns data even if database operations fail
     */
    public getCostData(): CostData {
        return { ...this.data };
    }
}

// Export singleton instance
export const costTracker = new CostTracker(); 
