import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { logger } from './logger';
import type { CostData } from './types';

const MONTHLY_SERVER_COST = 15.70; // Base monthly server cost in USD

class CostTracker {
    private readonly dataPath: string;
    private readonly dataDir: string;
    private data: CostData = {
        apiCosts: 0,
        serverCosts: MONTHLY_SERVER_COST,
        lastReset: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString()
    };

    constructor() {
        this.dataDir = join(process.cwd(), 'data');
        this.dataPath = join(this.dataDir, 'costs.json');
        this.initializeStorage().catch(error => {
            logger.error('Failed to initialize cost tracker:', error);
        });
    }

    private async initializeStorage(): Promise<void> {
        try {
            await mkdir(this.dataDir, { recursive: true });
            await this.loadData();
            await this.checkMonthlyReset();
        } catch (error) {
            logger.error('Failed to initialize storage:', error);
            throw error;
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
                logger.info('Performing monthly cost reset on the first of the month');
                this.data.apiCosts = 0;
                this.data.serverCosts = MONTHLY_SERVER_COST;
                this.data.lastReset = today;
                await this.saveData();
            }
        }
    }

    private async loadData(): Promise<void> {
        try {
            const content = await readFile(this.dataPath, 'utf-8');
            this.data = JSON.parse(content);
            // Ensure server costs are set
            this.data.serverCosts = MONTHLY_SERVER_COST;
            logger.info('Cost data loaded successfully');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                logger.info('No existing cost data found, starting fresh');
                await this.saveData();
            } else {
                logger.error('Error loading cost data:', error);
                throw error;
            }
        }
    }

    private async saveData(): Promise<void> {
        try {
            await writeFile(this.dataPath, JSON.stringify(this.data, null, 2));
            logger.debug('Cost data saved successfully');
        } catch (error) {
            logger.error('Failed to save cost data:', error);
            throw error;
        }
    }

    public async trackRequest(requestData: {
        id: string;
        model: string;
        cost: number;
        tokens: {
            prompt: number;
            completion: number;
            total: number;
        };
    }): Promise<void> {
        await this.checkMonthlyReset();

        this.data.apiCosts += requestData.cost;
        this.data.lastUpdated = new Date().toISOString();

        await this.saveData();
        logger.debug('Request cost tracked:', {
            id: requestData.id,
            model: requestData.model,
            cost: requestData.cost.toFixed(4),
            apiTotal: this.data.apiCosts.toFixed(4),
            serverCost: this.data.serverCosts.toFixed(2)
        });
    }

    public getMonthlyTotal(): number {
        return this.data.apiCosts + this.data.serverCosts;
    }

    public getMonthlyAPITotal(): number {
        return this.data.apiCosts;
    }

    public getMonthlyServerCost(): number {
        return this.data.serverCosts;
    }

    public getLastReset(): string {
        return this.data.lastReset;
    }

    public getLastUpdated(): string {
        return this.data.lastUpdated;
    }
}

// Export singleton instance
export const costTracker = new CostTracker(); 