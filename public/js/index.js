"use strict";
class CostDisplay {
    constructor() {
        this.USD_TO_CAD = 1.70;
        this.updateInterval = 60000; // 1 minute
        this.initialize();
    }
    initialize() {
        // Update costs immediately and start interval
        this.updateCosts();
        setInterval(() => this.updateCosts(), this.updateInterval);
    }
    formatCost(usdAmount) {
        const cadAmount = usdAmount * this.USD_TO_CAD;
        // Round up to next cent (multiply by 100, ceil, then divide by 100)
        const roundedAmount = Math.ceil(cadAmount * 100) / 100;
        return `$${roundedAmount.toFixed(2)} CAD`;
    }
    async updateCosts() {
        try {
            const response = await fetch('/api/costs');
            const data = await response.json();
            const totalCost = data.apiCosts + data.serverCosts;
            document.querySelector('.cost-total').textContent = this.formatCost(totalCost);
            document.querySelector('.server-cost').textContent = this.formatCost(data.serverCosts);
            document.querySelector('.api-cost').textContent = this.formatCost(data.apiCosts);
        }
        catch (error) {
            console.error('Failed to fetch costs:', error);
            document.querySelector('.cost-total').textContent = 'Error';
        }
    }
}
// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CostDisplay();
});
