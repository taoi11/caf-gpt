// Types
interface RateLimitInfo {
    hourly: {
        remaining: number;
        resetIn: number;
    };
    daily: {
        remaining: number;
        resetIn: number;
    };
}

export class RateLimitDisplay {
    private readonly hourlyElement: HTMLElement;
    private readonly dailyElement: HTMLElement;

    constructor() {
        this.hourlyElement = document.querySelector('.hourly-remaining')!;
        this.dailyElement = document.querySelector('.daily-remaining')!;
    }

    private formatLimit(info: { remaining: number; resetIn: number }): string {
        return `${info.remaining} left`;
    }

    public async updateLimits(): Promise<void> {
        try {
            const response = await fetch('/api/ratelimit');
            const data: RateLimitInfo = await response.json();
            
            console.info('Rate limit update:', data);
            
            // Update displays with remaining counts
            this.hourlyElement.textContent = this.formatLimit({
                remaining: Math.max(0, data.hourly.remaining),
                resetIn: data.hourly.resetIn
            });
            this.dailyElement.textContent = this.formatLimit({
                remaining: Math.max(0, data.daily.remaining),
                resetIn: data.daily.resetIn
            });

            // Add warning class if close to limit
            this.hourlyElement.classList.toggle('warning', data.hourly.remaining <= 3);
            this.dailyElement.classList.toggle('warning', data.daily.remaining <= 10);

        } catch (error) {
            console.error('Failed to fetch rate limits:', error);
            this.hourlyElement.textContent = 'Error';
            this.dailyElement.textContent = 'Error';
            this.hourlyElement.classList.add('error');
            this.dailyElement.classList.add('error');
        }
    }

    public async initializeDisplay(): Promise<void> {
        try {
            await this.updateLimits();
        } catch (error) {
            console.error('Failed to initialize rate limit display:', error);
        }
    }
}

// Export singleton instance
export const rateLimiter = new RateLimitDisplay(); 