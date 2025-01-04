// USD to CAD conversion rate
const USD_TO_CAD = 1.7;

// Format currency in CAD with ceiling to next cent
function formatCAD(usdAmount: number): string {
    const cadAmount = usdAmount * USD_TO_CAD;
    // Handle rounding to next cent properly for both positive and negative values
    const roundedAmount = Math.sign(cadAmount) * Math.ceil(Math.abs(cadAmount) * 100) / 100;
    return `$${roundedAmount.toFixed(2)} CAD`;
}

// Update cost display
async function updateCostDisplay() {
    try {
        const response = await fetch('/api/costs');
        if (!response.ok) {
            throw new Error('Failed to fetch costs');
        }

        const data = await response.json();
        
        // Update display elements with CAD values
        document.getElementById('apiCost')!.textContent = formatCAD(data.apiCosts);
        document.getElementById('serverCost')!.textContent = formatCAD(data.serverCosts);
        document.getElementById('totalCost')!.textContent = formatCAD(data.apiCosts + data.serverCosts);
    } catch (error) {
        console.error('Error updating costs:', error);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Single cost update on page load
    updateCostDisplay();
});