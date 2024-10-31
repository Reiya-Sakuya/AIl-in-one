document.addEventListener('DOMContentLoaded', () => {
    initializePointCloud();
    document.getElementById('userInput').addEventListener('keydown', handleInput);
});

function handleInput(event) {
    if (event.key === 'Enter') {
        const userInput = event.target.value;
        if (userInput) {
            const optimizedInput = optimizePrompt(userInput);
            callAIModels(optimizedInput);
            event.target.value = ''; // Clear input
        }
    }
} 