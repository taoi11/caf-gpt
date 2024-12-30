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
    private readonly updateInterval = 5000; // 5 seconds
    private readonly hourlyElement: HTMLElement;
    private readonly dailyElement: HTMLElement;
    private isIPv6: boolean = false;

    constructor() {
        this.hourlyElement = document.querySelector('.hourly-remaining')!;
        this.dailyElement = document.querySelector('.daily-remaining')!;
    }

    private async checkIPVersion(): Promise<void> {
        try {
            const response = await fetch('/api/ratelimit/ip-info');
            const data = await response.json();
            this.isIPv6 = data.isIPv6;
            this.updateIPVersionDisplay();
        } catch (error) {
            console.error('Failed to check IP version:', error);
        }
    }

    private updateIPVersionDisplay(): void {
        const container = this.hourlyElement.closest('.info-box');
        if (container) {
            container.classList.toggle('ipv6', this.isIPv6);
            container.setAttribute('title', `Using ${this.isIPv6 ? 'IPv6' : 'IPv4'} rate limits`);
        }
    }

    private formatTime(ms: number): string {
        if (ms < 60000) { // Less than a minute
            return 'soon';
        }
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        return `${minutes}m`;
    }

    private formatLimit(info: { remaining: number; resetIn: number }): string {
        const timeLeft = this.formatTime(info.resetIn);
        return `${info.remaining} left (resets ${timeLeft})`;
    }

    public async updateLimits(): Promise<void> {
        try {
            const response = await fetch('/api/ratelimit');
            const data: RateLimitInfo = await response.json();
            
            console.info('Rate limit update:', data);
            
            // Update displays with reset times
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

    // Add method to initialize with immediate update
    public async initializeDisplay(): Promise<void> {
        try {
            // Check IP version and update limits immediately
            await this.checkIPVersion();
            await this.updateLimits();
            
            // Then start regular interval updates
            setInterval(() => this.updateLimits(), this.updateInterval);
        } catch (error) {
            console.error('Failed to initialize rate limit display:', error);
        }
    }
}

// Export singleton instance
export const rateLimiter = new RateLimitDisplay(); 