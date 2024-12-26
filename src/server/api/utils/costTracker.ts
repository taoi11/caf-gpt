import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { logger } from '../../logger';
import type { CostData } from '../../../types';

const MONTHLY_SERVER_COST = 15.70; // Base monthly server cost in USD

class CostTracker {
    private readonly dataPath: string;
    private readonly dataDir: string;
    private data: CostData = {
        monthlyTotal: 0,
        lastReset: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString(),
        requests: []
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
        const today = new Date().toISOString().split('T')[0];
        const lastResetDate = new Date(this.data.lastReset);
        const currentMonth = new Date().getMonth();

        // Check if we've moved to a new month
        if (lastResetDate.getMonth() !== currentMonth) {
            logger.info('Performing monthly cost reset');
            this.data.monthlyTotal = 0;
            this.data.requests = [];
            this.data.lastReset = today;
            await this.saveData();
        }
    }

    private async loadData(): Promise<void> {
        try {
            const content = await readFile(this.dataPath, 'utf-8');
            this.data = JSON.parse(content);
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

        this.data.requests.push({
            ...requestData,
            timestamp: new Date().toISOString()
        });

        this.data.monthlyTotal += requestData.cost;
        this.data.lastUpdated = new Date().toISOString();

        await this.saveData();
        logger.debug('Request cost tracked:', {
            id: requestData.id,
            model: requestData.model,
            cost: requestData.cost.toFixed(4),
            monthlyTotal: this.data.monthlyTotal.toFixed(4)
        });
    }

    public getMonthlyTotal(): number {
        return this.data.monthlyTotal + MONTHLY_SERVER_COST;
    }

    public getMonthlyAPITotal(): number {
        return this.data.monthlyTotal;
    }

    public getMonthlyServerCost(): number {
        return MONTHLY_SERVER_COST;
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