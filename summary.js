async function fetchSummaryResponse(responses) {
    // Implement summary model API call logic here
    return fetch('https://api.example.com/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses })
    }).then(response => response.json());
}

function displaySummary(summary) {
    const responseBox = document.getElementById('responseBox');
    responseBox.innerHTML = summary.content; // Display summary in response box
} 