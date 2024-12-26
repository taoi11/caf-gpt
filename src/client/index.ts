interface CostResponse {
    apiCosts: number;
    serverCosts: number;
    lastUpdated: string;
}

class CostDisplay {
    private readonly USD_TO_CAD = 1.70;
    private readonly updateInterval = 60000; // 1 minute

    constructor() {
        this.initialize();
    }

    private initialize(): void {
        // Update costs immediately and start interval
        this.updateCosts();
        setInterval(() => this.updateCosts(), this.updateInterval);
    }

    private formatCost(usdAmount: number): string {
        const cadAmount = usdAmount * this.USD_TO_CAD;
        // Round up to next cent (multiply by 100, ceil, then divide by 100)
        const roundedAmount = Math.ceil(cadAmount * 100) / 100;
        return `$${roundedAmount.toFixed(2)} CAD`;
    }

    private async updateCosts(): Promise<void> {
        try {
            const response = await fetch('/api/costs');
            const data: CostResponse = await response.json();
            
            const totalCost = data.apiCosts + data.serverCosts;
            
            document.querySelector('.cost-total')!.textContent = this.formatCost(totalCost);
            document.querySelector('.server-cost')!.textContent = this.formatCost(data.serverCosts);
            document.querySelector('.api-cost')!.textContent = this.formatCost(data.apiCosts);
        } catch (error) {
            console.error('Failed to fetch costs:', error);
            document.querySelector('.cost-total')!.textContent = 'Error';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CostDisplay();
}); 